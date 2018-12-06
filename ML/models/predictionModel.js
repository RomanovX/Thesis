const mongoose = require('../lib/db').mongoose;

const predictionModelSchema = new mongoose.Schema({
	activity: String,
	nextClusters: [],
	counts: [],
	user: {
		type: String,
		default: 0
	},
});

module.exports = mongoose.model('PredictionModel', predictionModelSchema);

