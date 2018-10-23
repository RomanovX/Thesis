const log = require('./log');
const em = require('expectation-maximization');
const ExpectationMaximization = require('ml-expectation-maximization').ExpectationMaximization;
const math = require('mathjs');

/**
 * @param activities {Array.<{activity: String, start: Object, end: Object, duration: Number}>}	Array of activity objects
 */

function calculateClusters(activities) {
	const rawStarts = activities.map(event => {
		// Calculate seconds since start of day
		const hours = event.start.getHours();
		const minutes = event.start.getMinutes() + (hours * 60);
		//const seconds = event.start.getSeconds() + (minutes * 60);

		return [minutes];
	});

	const rawDurations = activities.map(event => {
		return event.duration;
	});

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


module.exports = {
	calculateClusters: calculateClusters,
};