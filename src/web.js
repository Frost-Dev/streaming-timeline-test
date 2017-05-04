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
const clientSocketApi = ioClient('http://localhost:3001');

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

clientSocketApi.on('connect', () => {
	console.log('[web/clientSocketApi]connected.');
	ioServerFront.sockets.on('connection', serverSocketFront => {
		console.log(`connect: id=${serverSocketFront.id}`);
		let cookies = cookieParser.signedCookies(cookie.parse(serverSocketFront.request.headers.cookie), sessionSecret);

		store.get(cookies[sessionCookieName], (err, session) => {
			console.log(`[web/serverSocketFront]fetched session: ${inspect(session)}`);

			serverSocketFront.on('create-follow-test', data => {
				clientSocketApi.emit('create-follow-test', {
					target: data.value,
					applicationKey: 'hoge1234',
					accessKey: session.AccessKey
				});
			});

			serverSocketFront.on('create-status-test', data => {
				if (!session.AccessKey) {
					console.log('[web/serverSocketFront]error: unauthorized');
					ioServerFront.to(serverSocketFront.id).emit('error', {message: 'unauthorized'});
					return;
				}

				console.log('[web/serverSocketFront]send status data to api');
				clientSocketApi.emit('create-status-test', {
					text: data.value,
					applicationKey: 'hoge1234',
					accessKey: session.AccessKey
				});
			});

			clientSocketApi.on('status', data => {
				ioServerFront.to(serverSocketFront.id).emit('status', data);
			});

			clientSocketApi.on('error', data => {
				ioServerFront.to(serverSocketFront.id).emit('error', data);
			});
		});

		serverSocketFront.on('disconnect', () => {
			console.log(`[web]disconnect: id=${serverSocketFront.id}`);
		});
	});
});
