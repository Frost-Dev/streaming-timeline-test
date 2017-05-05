const inspect = require('util').inspect;
const app = require('express')();
const http = require('http').Server(app);

const ioServer = require('socket.io');
const ioServerWeb = ioServer(http);

const publisher = require('redis').createClient(6379, 'localhost');

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

ioServerWeb.sockets.on('connection', ioServerWebSocket => {
	console.log(`[api/ioServerWebSocket]connected. id=${ioServerWebSocket.id}`);

	const subscriber = require('redis').createClient(6379, 'localhost');

	// Web側からフォロー関係の作成の指示を受信したとき
	ioServerWebSocket.on('create-follow-test', data => {
		console.log(`[api/ioServerWebSocket]on create-follow-test`);

		if (data.applicationKey == null || data.accessKey == null) {
			// Web側にエラーを返す
			console.log(`[api/ioServerWeb]send error.`);
			ioServerWeb.to(ioServerWebSocket.id).emit('error', {message: 'applicationKey/AccessKey are empty'});

			return;
		}

		// Redisで購読
		console.log(`[api/subscriber]subscribe user '${data.target}'.`);
		subscriber.subscribe(`${data.target}`);
	});

	// Web側からステータス作成の指示を受信したとき
	ioServerWebSocket.on('create-status-test', data => {
		console.log(`[api/ioServerWebSocket]on create-status-test`);

		if (data.applicationKey == null || data.accessKey == null) {
			// Web側にエラーを返す
			console.log(`[api/ioServerWeb]send error.`);
			ioServerWeb.to(ioServerWebSocket.id).emit('error', {message: 'applicationKey/AccessKey are empty'});

			return;
		}

		const userId = findUser(data.accessKey).userId;

		// Redisで出版
		console.log(`[api/publisher]publish status. user=${userId}`);
		publisher.publish(userId, JSON.stringify(data));
	});

	// Redisで購読している対象からのメッセージを受信したとき
	subscriber.on('message', (userId, data) => {
		console.log('[api/subscriber]on message: userId=' + userId + ', data=' + data);

		// Web側にステータス情報を返す
		console.log(`[api/ioServerWeb]send status to user ${ioServerWebSocket.id}.`);
		ioServerWeb.to(ioServerWebSocket.id).emit('status', JSON.parse(data));
	});

	ioServerWebSocket.on('disconnect', () => {
		console.log(`[api/ioServerWebSocket]on disconnect: id=${ioServerWebSocket.id}`);
	});
});
