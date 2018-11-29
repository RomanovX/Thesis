const mongoose = require('../lib/db').mongoose;

const clusterModelSchema = new mongoose.Schema({
	activity: String,
	model: Object,
	user: {
		type: String,
		default: 0
	},
});

module.exports = mongoose.model('ClusterModel', clusterModelSchema);

