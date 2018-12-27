const mongoose = require('../lib/db').mongoose;

const userSchema = new mongoose.Schema({
	id: String,
	values: Object,
});

module.exports = mongoose.model('User', userSchema);

