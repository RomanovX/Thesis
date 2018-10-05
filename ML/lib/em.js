const log = require('./log');
const em = require('expectation-maximization');

/**
 * @param activities {Array.<{activity: String, start: Object, end: Object, duration: Number}>}	Array of activity objects
 */
function calculateClusters(activities) {
	const rawArray = activities.map(event => {
		// Calculate seconds since start of day
		const hours = event.start.getHours();
		const minutes = event.start.getMinutes() + (hours * 60);
		const seconds = event.start.getSeconds() + (minutes * 60);

		return [seconds, event.duration];
	});

	return em(rawArray, 2);
}

module.exports = {
	calculateClusters: calculateClusters,
};