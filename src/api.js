const inspect = require('util').inspect;
const app = require('express')();
const http = require('http').Server(app);

const ioServer = require('socket.io');
const ioServerWeb = ioServer(http);

const publisher = require('redis').createClient(6379, 'localhost');
const subscriber = require('redis').createClient(6379, 'localhost');

http.listen(3001, () => {
	console.log(`listen on port: 3001`);
});

// 仮のUserデータベース
const userDb = [
	{accessKey: 'user_a_access_key', userId: 'user_a_id'}
];
const findUser = (accessKey) => {
	return userDb.find(i => i.accessKey === data.accessKey);
};

ioServerWeb.sockets.on('connection', serverSocketWeb => {
	console.log(`connect: id=${serverSocketWeb.id}`);

	// Web側からフォロー関係の作成の指示を受信したとき
	serverSocketWeb.on('create-follow-test', data => {
		console.log(`[api/create-follow-test]data: '${inspect(data)}'`);
		if (data.applicationKey == null || data.accessKey == null) {
			console.log('[api/create-follow-test]error: applicationKey/AccessKey are empty');

			// Web側にエラーを返す
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});
			return;
		}

		console.log('[api/create-follow-test]follow: ' + data.target);

		// Redisで購読
		subscriber.subscribe(`${data.target}`);
	});

	// Web側からステータス作成の指示を受信したとき
	serverSocketWeb.on('create-status-test', data => {
		console.log(`[api/create-status-test]data: '${inspect(data)}'`);
		if (data.applicationKey == null || data.accessKey == null) {
			console.log('[api/create-status-test]error: applicationKey/AccessKey are empty');

			// Web側にエラーを返す
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});
			return;
		}

		const userId = findUser(data.accessKey).userId;

		// Redisで出版
		publisher.publish(userId, JSON.stringify(data));
	});

	// Redisで購読している対象からのメッセージを受信したとき
	subscriber.on('message', (userId, data) => {
		console.log('[api/subscriber]event: userId=' + userId + ', data=' + data);

		// Web側にステータス情報を返す
		ioServerWeb.to(serverSocketWeb.id).emit('status', JSON.parse(data));
	});

	serverSocketWeb.on('disconnect', () => {
		console.log(`[api]disconnect: id=${serverSocketWeb.id}`);
	});
});
