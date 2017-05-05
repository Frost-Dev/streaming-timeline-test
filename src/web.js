const path = require('path');
const inspect = require('util').inspect;
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const app = require('express')();
const http = require('http').Server(app);

const ioServer = require('socket.io');
const ioClient = require('socket.io-client');
const ioServerFront = ioServer(http);
const ioClientApiSocket = ioClient('http://localhost:3001');

const store = new RedisStore({db: 1});
const sessionCookieName = 'sid'
const sessionSecret = 'hogepiyo';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(session({
	name: sessionCookieName,
	store: store,
	secret: sessionSecret,
	resave: true,
	saveUninitialized: true
}));

app.get('/login', (req, res) => {
	console.log('[web/session]set accessKey.');
	req.session.AccessKey = 'user_a_access_key';
	res.send('login.');
});

app.get('/logout', (req, res) => {
	console.log('[web/session]clear session.');
	req.session.destroy();
	res.send('logout.');
});

app.get('/', (req, res) => {
	res.render('timeline', {});
});

http.listen(3000, () => {
	console.log(`listen on port: 3000`);
});

ioClientApiSocket.on('connect', () => {
	console.log('[web/ioClientApiSocket]connected.');
	ioServerFront.sockets.on('connection', ioServerFrontSocket => {
		console.log(`connect: id=${ioServerFrontSocket.id}`);
		let cookies = cookieParser.signedCookies(cookie.parse(ioServerFrontSocket.request.headers.cookie), sessionSecret);

		store.get(cookies[sessionCookieName], (err, session) => {
			console.log(`[web/ioServerFrontSocket]fetched session: ${inspect(session)}`);

			// フロント側からフォロー関係の作成の指示を受信したとき
			ioServerFrontSocket.on('create-follow-test', data => {
				console.log('[web/ioServerFrontSocket]send to api follow relationship');

				// API側にフォロー関係の作成を指示
				ioClientApiSocket.emit('create-follow-test', {
					target: data.value,
					applicationKey: 'hoge1234',
					accessKey: session.AccessKey
				});
			});

			// フロント側からステータスの作成の指示を受信したとき
			ioServerFrontSocket.on('create-status-test', data => {
				if (!session.AccessKey) {
					console.log('[web/ioServerFrontSocket]error: unauthorized');

					// フロント側にエラーを返す
					ioServerFront.to(ioServerFrontSocket.id).emit('error', {message: 'unauthorized'});
					return;
				}

				console.log('[web/ioServerFrontSocket]send status data to api');

				// API側にステータス作成を指示
				ioClientApiSocket.emit('create-status-test', {
					text: data.value,
					applicationKey: 'hoge1234',
					accessKey: session.AccessKey
				});
			});

			// API側からステータス情報を受信
			ioClientApiSocket.on('status', data => {
				// フロント側にステータス情報を返す
				ioServerFront.to(ioServerFrontSocket.id).emit('status', data);
			});

			// API側からエラーを受信
			ioClientApiSocket.on('error', data => {
				// フロント側にエラーを返す
				ioServerFront.to(ioServerFrontSocket.id).emit('error', data);
			});
		});

		ioServerFrontSocket.on('disconnect', () => {
			console.log(`[web]disconnect: id=${ioServerFrontSocket.id}`);
		});
	});
});
