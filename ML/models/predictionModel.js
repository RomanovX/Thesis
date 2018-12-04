const mongoose = require('../lib/db').mongoose;

const predictionModelSchema = new mongoose.Schema({
	activity: String,
	totalCount: Number,
	nextClusters: [],
	user: {
		type: String,
		default: 0
	},
});

module.exports = mongoose.model('PredictionModel', predictionModelSchema);

