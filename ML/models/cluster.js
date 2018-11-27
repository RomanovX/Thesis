const mongoose = require('../lib/db').mongoose;

const clusterSchema = new mongoose.Schema({
	activity: String,
	parameters: Object,
	duration: Object,
	model: Object,
	user: {
		type: String,
		default: 0
	},
	predictionModel: Object
});

module.exports = mongoose.model('Cluster', clusterSchema);

