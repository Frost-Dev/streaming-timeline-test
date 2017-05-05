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
	{accessKey: 'user_a_access_key', userId: 'user_a_id'},
	{accessKey: 'user_b_access_key', userId: 'user_b_id'}
];
const findUser = (accessKey) => {
	return userDb.find(i => i.accessKey === accessKey);
};

ioServerWeb.sockets.on('connection', serverSocketWeb => {
	console.log(`[api/serverSocketWeb]connected. id=${serverSocketWeb.id}`);

	// Web側からフォロー関係の作成の指示を受信したとき
	serverSocketWeb.on('create-follow-test', data => {
		console.log(`[api/serverSocketWeb]on create-follow-test`);

		if (data.applicationKey == null || data.accessKey == null) {
			// Web側にエラーを返す
			console.log(`[api/ioServerWeb]send error.`);
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});

			return;
		}

		// Redisで購読
		console.log(`[api/subscriber]subscribe user '${data.target}'.`);
		subscriber.subscribe(`${data.target}`);
	});

	// Web側からステータス作成の指示を受信したとき
	serverSocketWeb.on('create-status-test', data => {
		console.log(`[api/serverSocketWeb]on create-status-test`);

		if (data.applicationKey == null || data.accessKey == null) {
			// Web側にエラーを返す
			console.log(`[api/ioServerWeb]send error.`);
			ioServerWeb.to(serverSocketWeb.id).emit('error', {message: 'applicationKey/AccessKey are empty'});

			return;
		}

		const userId = findUser(data.accessKey).userId;

		// Redisで出版
		console.log(`[api/publisher]publish status.`);
		publisher.publish(userId, JSON.stringify(data));
	});

	// Redisで購読している対象からのメッセージを受信したとき
	subscriber.on('message', (userId, data) => {
		console.log('[api/subscriber]on message: userId=' + userId + ', data=' + data);

		// Web側にステータス情報を返す
		console.log(`[api/ioServerWeb]send status.`);
		ioServerWeb.to(serverSocketWeb.id).emit('status', JSON.parse(data));
	});

	serverSocketWeb.on('disconnect', () => {
		console.log(`[api/serverSocketWeb]on disconnect: id=${serverSocketWeb.id}`);
	});
});
