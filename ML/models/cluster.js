const mongoose = require('../lib/db').mongoose;

const clusterSchema = new mongoose.Schema({
	activity: String,
	parameters: Object,
	duration: Object,
	user: {
		type: String,
		default: 0
	},
});

module.exports = mongoose.model('Cluster', clusterSchema);

