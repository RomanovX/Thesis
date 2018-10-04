const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

let connection = null;

module.exports.connect = function(config, cb) {
	if (connection !== null) {
		throw new Error("Can only have 1 Mongo connection");
	}
	connection = mongoose.connect("mongodb://" + config.host, {
		user: config.user,
		pass: config.pwd,
		useNewUrlParser: true,
		dbName: config.db,
		replicaSet: 'Activities-shard-0',
		retryWrites: true,
		authSource: 'admin',
		ssl: true
	}, cb);
	return connection;
};

module.exports.mongoose = mongoose;
module.exports.connection = connection;