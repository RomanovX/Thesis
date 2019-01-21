const mongoose = require('../lib/db').mongoose;

const activitySchema = new mongoose.Schema({
	activity: String,
	start: Date,
	end: Date,
	rawStart: Number,
	duration: Number,
	user: {
		type: String,
		default: 0
	}
});

module.exports = mongoose.model('Activity', activitySchema);