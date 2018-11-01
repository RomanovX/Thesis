const log = require('./log');
const em = require('expectation-maximization');
const ExpectationMaximization = require('ml-expectation-maximization').ExpectationMaximization;
const math = require('mathjs');
const Apriori = require('apriori');
const extend = require('extend');

/**
 * @param activity 			{Object} 	Activity Object
 * @param activity.start	{Date}		Date object describing start
 *
 * @returns 				{Number}	Starting time in minutes since start of day
 */
function getMinutesSinceMidnight(activity) {
	const hours = activity.start.getHours();
	const minutes = activity.start.getMinutes() + (hours * 60);
	//const seconds = activity.start.getSeconds() + (minutes * 60);

	return minutes;
}

/**
 * @param activities {Array.<{activity: String, start: Object, end: Object, duration: Number}>}	Array of activity objects
 */
function calculateClusters(activities) {

	// Initialize all resulting arrays
	const rawStarts = [];
	const rawDurations = [];
	const linkedActivities = [];

	for (let i = 0; i < activities.length; i++) {
		rawStarts.push([
			getMinutesSinceMidnight(activities[i])
		]);

		rawDurations.push(activities[i].duration);

		// Note: No need for a deep copy since we are adding, not changing, information
		const nextActivity = (i < activities.length - 1) ? activities[i - 1].activity : null;
		linkedActivities.push(extend({}, activities[i], {nextActivity: nextActivity}))
	}

	const minSigma = Math.pow(10,-6);
	let nClusters = 1;
	let finalClusters;
	let finalModel;

	while (nClusters < 10) {
		const model = new ExpectationMaximization({numClusters: nClusters});
		model.train(rawStarts); // data is a training matrix
		const rawClusters = model.getClusterData();
		const clusters = rawClusters.map(cluster => {
			return {mean: cluster.mean[0][0], sigma: cluster.covariance[0][0], weight: cluster.weight};
		});
		if (nClusters === 1 || clusters.every(cluster => cluster.sigma > minSigma)) {
			finalClusters = clusters;
			finalModel = model;
		} else {
			break;
		}
		nClusters++;
	}

	const clusterIndices = finalModel.predict(rawStarts);
	const clusterElements = [];

	for (let i = 0; i < rawDurations.length; i++) {
		const key = +clusterIndices[i];
		if(!clusterElements[key]) {
			clusterElements[key] = [];
		}
		clusterElements[key].push(rawDurations[i]);
	}

	const durationParameters = clusterElements.map(durationArray => {
		return {mean: math.mean(durationArray), sigma: math.var(durationArray)};
	});


	return {model: finalModel, clusters: finalClusters, durations: durationParameters};
}

function predict(cluster) {}

module.exports = {
	calculateClusters: calculateClusters,
};