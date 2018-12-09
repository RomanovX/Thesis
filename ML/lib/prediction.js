const em = require('ml-expectation-maximization').ExpectationMaximization;
const array = {mean: require('ml-array-mean'), variance: require('ml-array-variance')};
const { Matrix, EigenvalueDecomposition } = require('ml-matrix');
const util = require('./util');

/**
 * @typedef  {Object} activity
 * @property {string} activity 	Name of the activity.
 * @property {string} user	 	UserID
 * @property {Object} start 	Date object describing start time and date
 * @property {Object} end	 	Date object describing end time and date
 * @property {number} duration 	Number describing duration in seconds
 */

/**
 * @typedef  {Object} clusterModel
 * @property {string} activity 	Name of the activity.
 * @property {string} user	 	UserID
 * @property {Object} model 	Parameters describing cluster. Loadable through em.load(model)
 */

/**
 * @typedef  {Object} predictionModel
 * @property {string} 							activity 		Name of the activity.
 * @property {string} 							user	 		UserID
 * @property {Array.<number>} 					counts	 		Counts of total recorded activities following this cluster (index of array is number of cluster)
 * @property {Array.<Object.<string, number>>} 	nextClusters 	Counts of recorded clusters following this cluster (index of array is number of cluster)
 */

/**
 * @param activity	{activity} 	Activity Object
 *
 * @returns 		{Number}	Starting time in minutes since start of day
 */
function getMinutesSinceMidnight(activity) {
	const hours = activity.start.getHours();
	const minutes = activity.start.getMinutes() + (hours * 60);
	//const seconds = activity.start.getSeconds() + (minutes * 60);

	return minutes;
}

/**
 * @param dataArray		{Array} 					Array containing data
 * @param indices		{Array.<Number>}			Array describing which cluster each entry belongs to
 *
 * @returns 			{Array.<Array.<Number>>}	Two dimensional array, where each sub array are the entries for the cluster of that index
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
 * @param activity		{activity}
 * @param clusterModel	{clusterModel}
 *
 * @returns 			{Number}	Index of cluster the activity is predicted to be in
 */
function getClusterIdx(activity, clusterModel) {
	const model = em.load(clusterModel.model);
	const rawStart = getMinutesSinceMidnight(lastActivity);
	const clusterIdx = model.predict([[rawStart]])[0];
	return clusterIdx;
}
/**
 * @param activities	{Array.<activity>}		Array of activity objects
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
		const model = new em({numClusters: nClusters});
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

	// Calculate duration parameters
	const durationParameters = clusterDurations.map(durationArray => {
		return {mean: array.mean(durationArray), sigma: array.variance(durationArray)};
	});

	return {model: finalModel.toJSON(), clusters: finalClusters, durations: durationParameters};
}

/**
 * @param activities 	{Array.<activity>}			Array of activity objects
 * @param clusterModels	{Array.<clusterModel>}		Array of clusterModels
 *
 * @returns 			{Array.<predictionModel>}	Name of predicted activity
 */
function calculatePredictionModels(activities, clusterModels) {
	// TODO: Rewrite dataContainer to Map
	const dataContainer = {};

	// Transform into a workable model
	clusterModels.forEach(cmDescription => {
		const model = em.load(cmDescription.model);
		const activity = cmDescription.activity;

		if (dataContainer[activity]) {
			throw Error('Multiple cluster models for the same activity: ' + activity);
		}

		const nextClustersPrefab = Array.from({ length: model.numClusters }, () => new Object({}));

		dataContainer[activity] = {
			user: cmDescription.user,
			activity: activity,
			model: model,
			entries: [],
			nextClusters: nextClustersPrefab,
			counts: []
		}
	});

	// TODO: this and the one below can be combined into one loop
	activities.forEach((entry, index) => {
		const rawStart = getMinutesSinceMidnight(entry);
		const dc = dataContainer[entry.activity];
		const clusterIndex = dc.model.predict([[rawStart]]);

		if(!dc.entries[clusterIndex]) {
			dc.entries[clusterIndex] = [];
		}
		entry.clusterIndex = clusterIndex;

		if (index < activities.length - 1) {
			entry.nextActivity = activities[index + 1];
		}
		dc.entries[clusterIndex].push(entry);
	});

	Object.keys(dataContainer).forEach(activity => {
		dataContainer[activity].entries.forEach((clusterEntries, clusterIdx) => {
			clusterEntries.forEach(entry => {
				const nextClusters = dataContainer[activity].nextClusters[clusterIdx];

				const next = entry.nextActivity;
				if(!next) {
					return;
				}
				const key = next.activity + "_" + next.clusterIndex;

				if (!nextClusters[key]) {
					nextClusters[key] = 1;
				} else {
					nextClusters[key]++;
				}

				if (!dataContainer[activity].counts[clusterIdx]) {
					dataContainer[activity].counts[clusterIdx] = 0;
				}
				dataContainer[activity].counts[clusterIdx]++;
			})
		});

		// Delete entries since we do not want to store them
		delete dataContainer[activity].entries;
		delete dataContainer[activity].model;
	});

	return Object.values(dataContainer);
}

/**
 * @param lastActivity	 	{activity}			Last activity as recorded for the user
 * @param clusterModel		{clusterModel}		Cluster model corresponding to the activity
 * @param predictionModel	{predictionModel}	Prediction model corresponding to the activity
 *
 * @returns 				{Array.<{activity: string, cluster: number, probability: number}>}	Name of the predicted activity and its cluster
 */
function predict(lastActivity, clusterModel, predictionModel) {
	const clusterIdx = getClusterIdx(lastActivity, clusterModel);
	const singleProb = 1 / predictionModel.counts[clusterIdx];
	const nextClusters = predictionModel.nextClusters[clusterIdx];
	if (!nextClusters) {
		return null;
	}
	const max = Object.keys(nextClusters).filter(x => {
		return nextClusters[x] === Math.max.apply(null,	Object.values(nextClusters));
	});
	const result = max.map(a => {
		const data = a.split("_");
		return {activity: data[0], cluster: +data[1], probability: nextClusters[a] * singleProb}
	});

	return result;
}

/**
 * @param lastActivity	 	{activity}					Last activity as recorded for the user
 * @param clusterModel		{clusterModel}				Cluster model corresponding to the activity
 * @param predictionModels	{Array.<predictionModel>}	All the user's prediction models
 * @param clusterCount		{Number}					Number of unique clusters of the user
 *
 * @returns 				{{activity: string, cluster: number, value: number, stepsFromStart: number, stepsFromEnd: number}}	Name of the predicted activity and its cluster
 */
function findMoment(lastActivity, clusterModel, predictionModels, clusterCount) {
	//const clusterModelDict = util.arrToObj(clusterModels, 'activity');
	const predictionModelDict = util.arrToObj(predictionModels, 'activity');

	let nextIdx = 0;
	const clusterIdxDict = {};
	const transitionMatrix = Matrix.zeros(clusterCount, clusterCount);

	function getIndex(key) {
		if (!(key in clusterIdxDict)) {
			clusterIdxDict[key] = nextIdx++;
		}
		return clusterIdxDict[key];
	}

	predictionModels.forEach(model => {
		model.nextClusters.forEach((cluster, index) => {
			const singleProb = 1 / model.counts[index];
			const fromKey = model.activity + '_' + index;
			const fromIdx = getIndex(fromKey);
			Object.keys(cluster).forEach(toKey => {
				const toIdx = getIndex(toKey);
				transitionMatrix.set(fromIdx, toIdx, cluster[toKey]*singleProb)
			})
		})
	});

	// const start = getClusterIdx(lastActivity, clusterModel);
	// const startKey = lastActivity.activity + '_' + start;
	// const startIdx = getIndex(startKey);

	let stepMatrix = transitionMatrix;
	let steps = 1;

	while(true) {
		const t2d = stepMatrix.to2DArray();
		const sums = t2d.map(row => row.reduce((a, b) => a + b, 0));
		stepMatrix = stepMatrix.mmul(stepMatrix);
		if (util.assert2dArray(t2d, stepMatrix.to2DArray())) {
			console.log(`Found stationary matrix after ${steps} steps`);
			break;
		}
		console.log(steps++);
	}



	const evd = new EigenvalueDecomposition(transitionMatrix.transpose());
	const eigenvectors = evd.eigenvectorMatrix;
	const stationary = eigenvectors.to2DArray().filter(row => row.every(value => value >= 0));

	console.log(transitionMatrix);
}

module.exports = {
	calculateClusters: calculateClusters,
	calculatePredictionModels: calculatePredictionModels,
	predict: predict,
	findMoment: findMoment,
};