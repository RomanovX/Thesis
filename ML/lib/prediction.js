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

		return seconds;
	});

	let nClusters = 1;
	let clusters;

	while (nClusters) {
		clusters = em(rawArray, nClusters);
		nClusters++;
	}

	return clusters;
}

module.exports = {
	calculateClusters: calculateClusters,
};