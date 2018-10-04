const mongoose = require('../lib/db').mongoose;

const activitySchema = new mongoose.Schema({
	activity: String,
	start: Date,
	end: Date,
	duration: Number,
});

module.exports = mongoose.model('Activity', activitySchema);

