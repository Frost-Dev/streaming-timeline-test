const app = require('express')();
const http = require('http').Server(app);
const ioServer = require('socket.io');
const ioServerWeb = ioServer(http);

const publisher = require('redis').createClient(6379, 'localhost');
const subscriber = require('redis').createClient(6379, 'localhost');

const userDb = [{accessKey: 'user_a_access_key', userId: 'user_a_id'}]

http.listen(3001, () => {
	console.log(`listen on port: 3001`);
});

const inspect = require('util').inspect;

ioServerWeb.sockets.on('connection', serverSocketWeb => {
	console.log(`connect: id=${serverSocketWeb.id}`);

	serverSocketWeb.on('create-follow-test', data => {
		console.log(`[api/create-follow-test]data: '${inspect(data)}'`);
		if (data.applicationKey == null || data.accessKey == null) {
			console.log('[api/create-follow-test]error: applicationKey/AccessKey are empty');
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});
			return;
		}

		console.log('[api/create-follow-test]follow: ' + data.target);
		subscriber.subscribe(`${data.target}`);
	});

	serverSocketWeb.on('create-status-test', data => {
		console.log(`[api/create-status-test]data: '${inspect(data)}'`);
		if (data.applicationKey == null || data.accessKey == null) {
			console.log('[api/create-status-test]error: applicationKey/AccessKey are empty');
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});
			return;
		}

		const userId = userDb.find(i => i.accessKey === data.accessKey).userId;

		publisher.publish(userId, JSON.stringify(data));
	});

	subscriber.on('message', (userId, data) => {
		console.log('[api/subscriber]event: userId=' + userId + ', data=' + data);
		ioServerWeb.to(serverSocketWeb.id).emit('status', JSON.parse(data));
	});

	serverSocketWeb.on('disconnect', () => {
		console.log(`[api]disconnect: id=${serverSocketWeb.id}`);
	});
});
