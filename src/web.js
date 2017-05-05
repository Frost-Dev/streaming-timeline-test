const path = require('path');
const inspect = require('util').inspect;
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const app = require('express')();
const http = require('http').Server(app);
const getSessionFromCookieAsync = require('./helpers/get-session-from-cookie-async');

const ioServer = require('socket.io');
const ioClient = require('socket.io-client');
const ioServerFront = ioServer(http);

const store = new RedisStore({db: 1});
const sessionCookieName = 'sid'
const sessionSecret = 'hogepiyo';
const applicationKey = 'hoge1234';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(session({
	name: sessionCookieName,
	store: store,
	secret: sessionSecret,
	resave: true,
	saveUninitialized: true
}));

app.get('/login/a', (req, res) => {
	console.log('[web/session]set accessKey.');
	req.session.userId = 'user_a_id';
	req.session.AccessKey = 'user_a_access_key';
	res.send('login.');
});

app.get('/login/b', (req, res) => {
	console.log('[web/session]set accessKey.');
	req.session.userId = 'user_b_id';
	req.session.AccessKey = 'user_b_access_key';
	res.send('login.');
});

app.get('/logout', (req, res) => {
	console.log('[web/session]clear session.');
	req.session.destroy();
	res.send('logout.');
});

app.get('/', (req, res) => {
	res.render('timeline', {userId: req.session.userId != null ? req.session.userId : '(unauthorized)'});
});

http.listen(3000, () => {
	console.log(`listen on port: 3000`);
});

ioServerFront.sockets.on('connection', ioServerFrontSocket => {
	const ioClientApiSocket = ioClient('http://localhost:3001');

	ioClientApiSocket.on('connect', () => {
		console.log(`[web/ioClientApiSocket]connected. id=${ioClientApiSocket.id}`);

		(async () => {
			console.log(`[web/ioServerFrontSocket]connected. id=${ioServerFrontSocket.id}`);

			const session = await getSessionFromCookieAsync(ioServerFrontSocket.request.headers.cookie, sessionCookieName, sessionSecret, store);
			console.log('[web/ioServerFrontSocket]fetched session.');

			// フロント側からフォロー関係の作成の指示を受信したとき
			ioServerFrontSocket.on('create-follow-test', data => {
				console.log('[web/ioServerFrontSocket]on create-follow-test');

				// API側にフォロー関係の作成を指示
				ioClientApiSocket.emit('create-follow-test', {
					target: data.value,
					applicationKey: applicationKey,
					accessKey: session.AccessKey
				});
			});

			// フロント側からステータスの作成の指示を受信したとき
			ioServerFrontSocket.on('create-status-test', data => {
				console.log('[web/ioServerFrontSocket]on create-status-test');

				if (!session.AccessKey) {
					console.log('[web/ioServerFrontSocket]error: unauthorized');

					// フロント側にエラーを返す
					ioServerFront.to(ioServerFrontSocket.id).emit('error', {message: 'unauthorized'});

					return;
				}

				// API側にステータス作成を指示
				ioClientApiSocket.emit('create-status-test', {
					text: data.value,
					applicationKey: applicationKey,
					accessKey: session.AccessKey
				});
			});

			// API側からステータス情報を受信したとき
			ioClientApiSocket.on('status', data => {
				console.log('[web/ioClientApiSocket]on status: accessKey=' + session.AccessKey);

				// フロント側にステータス情報を返す
				ioServerFront.to(ioServerFrontSocket.id).emit('status', data);
			});

			// API側からエラーを受信したとき
			ioClientApiSocket.on('error', data => {
				console.log('[web/ioClientApiSocket]on error');

				// フロント側にエラーを返す
				ioServerFront.to(ioServerFrontSocket.id).emit('error', data);
			});

			ioServerFrontSocket.on('disconnect', () => {
				console.log(`[web/ioServerFrontSocket]on disconnect: id=${ioServerFrontSocket.id}`);
			});
		})();
	});
});
