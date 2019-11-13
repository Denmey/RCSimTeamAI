const dgram = require('dgram'); // UDP Library

class SocketWrapper {
	constructor(agent) {
		this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
		this.socket.on('message', (msg, info) => {
			agent.processMsg(msg);
		});
	}

	sendMsg(msg, callback = null) {
		this.socket.send(Buffer.from(msg), 6000, 'localhost', (err, bytes) => {
			console.log("Sending", msg);
			if (err) {
				console.log("Error", err);
				throw err;
			} else {
				if (callback)
					callback();
			}
		});
	}
}

module.exports = SocketWrapper;
