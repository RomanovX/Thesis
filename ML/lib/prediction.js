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
 * @param dataArray			{Array} 					Array containing data
 * @param indices			{Array.<Number>}			Array describing which cluster each entry belongs to
 *
 * @returns 				{Array.<Array.<Number>>}	Two dimensional array, where each sub array are the entries for the cluster of that index
 */
function sortDataPerCluster(dataArray, indices) {
	const result = [];

	for (let i = 0; i < dataArray.length; i++) {
		const key = +indices[i];
		if(!result[key]) {
			result[key] = [];
		}
		result[key].push(dataArray[i]);
	}

	return result;
}

/**
 * @param activities {Array.<{activity: String, start: Object, end: Object, duration: Number}>}	Array of activity objects
 */
function calculateClusters(activities) {

	// Initialize all resulting arrays
	const rawStarts = [];
	const rawDurations = [];

	for (let i = 0; i < activities.length; i++) {
		rawStarts.push([
			getMinutesSinceMidnight(activities[i])
		]);

		rawDurations.push(activities[i].duration);
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

	// Get the index of the cluster to which each entry now most likely belongs
	const indices = finalModel.predict(rawStarts);

	// Generate sorted arrays with raw durations and the activities for each cluster
	const clusterDurations = sortDataPerCluster(rawDurations, indices);
	const clusterActivities = sortDataPerCluster(activities, indices);

	// Calculate duration parameters
	const durationParameters = clusterDurations.map(durationArray => {
		return {mean: math.mean(durationArray), sigma: math.var(durationArray)};
	});

	for (let i = 0; i < finalClusters.length; i++) {
		const cluster = finalClusters[i];
		const activities = clusterActivities[i];

		const a = activities[0];

		

	}


	return {model: finalModel, clusters: finalClusters, durations: durationParameters};
}

function predict(cluster) {

}

module.exports = {
	calculateClusters: calculateClusters,
};