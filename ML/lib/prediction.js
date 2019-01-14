const em = require('ml-expectation-maximization').ExpectationMaximization;
const array = {mean: require('ml-array-mean'), variance: require('ml-array-variance')};
const { Matrix, inverse } = require('ml-matrix');
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
 * @property {string} activity 			Name of the activity.
 * @property {string} user	 			UserID
 * @property {Object} model 			Parameters describing cluster. Loadable through em.load(model)
 * @property {String} model.model		Constant string identifying em model
 * @property {Array}  model.clusters	Array of objects containing the actual cluster parameters
 * @property {Number} model.epsilon		Parameter epsilon used when calculating the clusters
 * @property {String} model.numClusters	Number of clusters in model
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
 * @param mins	{Number} 	Minutes since midnight
 *
 * @returns 	{String}	Starting time string HH:MM
 */
function convertMinsToHrsMins(mins) {
	let h = Math.floor(mins / 60);
	let m = Math.floor(mins % 60);
	h = h < 10 ? '0' + h : h;
	m = m < 10 ? '0' + m : m;
	return `${h}:${m}`;
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
	const rawStart = getMinutesSinceMidnight(activity);
	const clusterIdx = model.predict([[rawStart]])[0];
	return clusterIdx;
}

/**
 * @param transitionMatrix		{Matrix}
 *
 * @returns 		{Matrix}	Stationary matrix with accuracy of 10^12
 */
function getStationaryMatrix(transitionMatrix) {
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
	}
	return stepMatrix;
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
 * @returns 				{Matrix}					Transition matrix
 */
function findTransition(lastActivity, clusterModel, predictionModels, clusterCount) {
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

	return transitionMatrix;
}

/**
 * @param lastActivity	 	{activity}						Last activity as recorded for the user
 * @param clusterModels		{Array.<clusterModel>}			All clusterModels corresponding to the activity
 * @param predictionModels	{Array.<predictionModel>}		All the user's prediction models
 * @param clusterCount		{Number}						Number of unique clusters of the user
 * @param finalModel		{clusterModel}					Cluster model corresponding to the final activity
 * @param values			{Object.<string, number>}		Dictionary of activities and their corresponding values
 *
 * @returns 				{{activity: string, cluster: number, value: number, stepsFromStart: number, stepsFromEnd: number}}	Name of the predicted activity and its cluster
 */
function findMoment(lastActivity, clusterModels, predictionModels, clusterCount, finalModel, values) {
	const clusterModelDict = util.arrToObj(clusterModels, 'activity');
	const finalActivity = finalModel.activity;

	// Note: Since it doesn't matter which cluster of the final activity is reached, these clusters are merged
	const mergedClusterCount = clusterCount - finalModel.model.numClusters + 1;
	const transitionMatrix = Matrix.zeros(mergedClusterCount, mergedClusterCount);

	// Keep a dictionary of cluster vs matrix index
	const clusterIdxDict = {};
	let nextIdx = 0;
	function getIndex(key) {
		if (!(key in clusterIdxDict)) {
			// Prepare for canonical form and put the final activity (which will be made absorbing) in the last row
			if (key === finalActivity) {
				clusterIdxDict[key] = mergedClusterCount - 1;
			} else {
				clusterIdxDict[key] = nextIdx++;
			}
		}
		return clusterIdxDict[key];
	}

	function overrideFinalCluster(key) {
		if (key.split("_")[0] === finalActivity) {
			return finalActivity;
		}
		return key;
	}

	function makeAbsorbing(idx) {
		const row = Array(mergedClusterCount).fill(0);
		row[idx] = 1;
		transitionMatrix.setRow(idx, row);
	}

	predictionModels.forEach(model => {
		model.nextClusters.forEach((cluster, index) => {
			// Quick fix
			if (!cluster) {
				return;
			}

			let singleProb = 1 / model.counts[index];
			// Scale probabilities for the final activity
			if (model.activity === finalActivity) {
				singleProb /= finalModel.model.numClusters;
			}
			const fromKey = model.activity + '_' + index;
			const fromIdx = getIndex(overrideFinalCluster(fromKey));
			Object.keys(cluster).forEach(toKey => {
				const toIdx = getIndex(overrideFinalCluster(toKey));
				let value = transitionMatrix.get(fromIdx, toIdx);
				transitionMatrix.set(fromIdx, toIdx, value + cluster[toKey]*singleProb);
			})
		})
	});

	// Check if transition matrix still all sums to near 1
	const test = transitionMatrix.sum("row").to1DArray();
	// if (!test.every(sum => Math.round(sum*10000000) / 10000000 === 1)) {
	// 	throw Error("Incorrect transition matrix. Not all row probabilities add up to 1")
	// }

	// Make the final activity absorbing
	makeAbsorbing(getIndex(finalActivity));

	/* Get canonical components
	 *
	 * This assumes the matrix is now in the form P = [[Q R], [0, I]]
	 * Since there is only one absorbing state, the identity matrix is of size 1-by-1
	 */
	const Q = transitionMatrix.subMatrix(0, mergedClusterCount - 2, 0, mergedClusterCount - 2);
	const R = transitionMatrix.subMatrix(0, mergedClusterCount - 2, mergedClusterCount - 1, mergedClusterCount - 1);

	// Finding the fundamental matrix N = (I - Q)^(-1), where I is of the same dimension as Q
	const I = Matrix.eye(mergedClusterCount - 1, mergedClusterCount - 1);
	const N = inverse(I.sub(Q));

	// Transient probabilities H = (N - I)*Ndg, where I is of the same dimension as N and for Ndg, see below
	const Ndg = Matrix.diag(N.diag()); // Diagonal matrix containing the diagonals of N
	const H = N.sub(I).mmul(inverse(Ndg));

	// Get index of starting cluster
	const start = getClusterIdx(lastActivity, clusterModelDict[lastActivity.activity]);
	const startKey = lastActivity.activity + '_' + start;
	const startIdx = getIndex(startKey);

	// Take corresponding transient probability row H_start
	const H_start = H.getRowVector(startIdx).to1DArray();

	// Expected number of steps until absorption t
	const t = N.mmul(Matrix.ones(mergedClusterCount - 1, 1)).add(1).to1DArray();

	// Check the weighting
	function weighting(probability, values, steps) {
		const calculatingValues = (values/4);
		const k = 1;
		return (calculatingValues * probability /steps)**0.5;
		// const calculatingValues = ((values/4)**2);
		// return calculatingValues*probability*100 - (steps**1.3) + 40;
	}

	// Get expected values
	const scores = [];
	Object.keys(clusterIdxDict).forEach(key => {
		if (key === finalActivity) {
			return;
		}
		const idx = clusterIdxDict[key];
		const [activity, cluster] = key.split("_");
		const value = +values[activity];

		//Add time info
		const avgTime = clusterModelDict[activity].model.clusters[cluster].gaussian.mu[0][0];
		const readableTime = convertMinsToHrsMins(avgTime);

		scores[idx] = {key: key, score: weighting(H_start[idx], value, t[idx]), time: readableTime};
	});

	scores.sort((a, b) => b.score - a.score);

	return [startKey, scores];
}

module.exports = {
	calculateClusters: calculateClusters,
	calculatePredictionModels: calculatePredictionModels,
	predict: predict,
	findMoment: findMoment,
	findTransition: findTransition,
	getClusterIdx: getClusterIdx,
};