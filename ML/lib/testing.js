const prediction = require('./prediction');
const util = require('./util');
const log = require('./log');

const extend = require('extend');

function getScoringFunction(m, n) {
	return function (probability, value, steps) {
		return probability * (value**m)/(steps**n);
	}
}

/**
 * @param activities	{Array.<activity>} 	Array of activities
 *
 * @returns 			{{training: Array.<activity>, testing: Array.<activity>}}
 */
function splitActivities(activities) {
	const split = Math.floor(activities.length * 8 / 10);
	return {
		training: activities.slice(0, split),
		testing: activities.slice(split)
	};
}

/**
 * @param lastActivity			{activity}	Last recorded activity
 * @param activities			{Array.<activity>} 	Array of past activities
 * @param futureActivities		{Array.<activity>} 	Array of future activities
 * @param clusterModelDict		{Object<string, clusterModel>} 		Dictionary of cluster models
 * @param predictionModelDict	{Object<string, predictionModel>} 	Dictionary of prediction models
 *
 * @return	{activity}
 */
function addActivity(lastActivity, activities, futureActivities, clusterModelDict, predictionModelDict) {
	// Get new activity and its information
	const nextActivity = futureActivities.shift();

	if (!nextActivity) {
		throwEmptyActivityListError();
	}

	const nextClusterIdx = prediction.getClusterIdx(nextActivity, clusterModelDict[nextActivity.activity]);
	const nextKey = nextActivity.activity + "_" + nextClusterIdx;

	// Get information about the last activity
	let lastClusterIdx = prediction.getClusterIdx(lastActivity, clusterModelDict[lastActivity.activity]);

	// Move it to the past activities list
	activities.push(nextActivity);

	// Update the prediction model
	const predictionModel = predictionModelDict[lastActivity.activity];
	const nextClusters = predictionModel.nextClusters[lastClusterIdx];
	const counts = predictionModel.counts;

	if (!nextClusters[nextKey]) {
		nextClusters[nextKey] = 1;
	} else {
		nextClusters[nextKey]++;
	}

	if (!counts[lastClusterIdx]) {
		counts[lastClusterIdx] = 1;
	} else {
		counts[lastClusterIdx]++;
	}

	return nextActivity;
}

/**
 * @returns					{Number}	Random value between 0 and 4
 */
function getRandomUserValue() {
	return Math.floor(Math.random() * 5);
}

function throwEmptyActivityListError() {
	throw {
		name: 'EmptyActivityListError',
		message: 'No remaining activities'
	};
}

/**
 * @param scenarioParameters	{{m: number, n: number}} 		Describing scenario parameters
 * @param deadline				{string}						Deadline activity name
 * @param lastActivity			{activity}						Last recorded activity
 * @param activities			{Array.<activity>} 				Array of past activities
 * @param futureActivities		{Array.<activity>} 				Array of future activities
 * @param predictionModels		{Array.<predictionModel>} 		Array of prediction models
 * @param clusterCount			{number}						Number of clusters
 * @param clusterModels			{Array.<clusterModel>} 			Array of cluster models
 * @param clusterModelDict		{Object.<string, clusterModel>} Dictionary of cluster models
 * @param userValues			{Object.<string, number>} 		Dictionary of user values per activity
 *
 * @returns 					{{success: boolean, normalizedScore: number, moment: string}}	 Scenario results
 */
function getResultsForScenario(scenarioParameters, deadline, lastActivity, activities, futureActivities, predictionModels, clusterCount, clusterModels, clusterModelDict, userValues) {
	// Copy all data that is bound to change
	const testActivities = extend(true, [], activities);
	const testFutureActivities = extend(true, [], futureActivities);
	const testPredictionModels = extend(true, [], predictionModels);
	const testPredictionModelDict = util.arrToDict(testPredictionModels, "activity");

	let testLastActivity = extend(true, {}, lastActivity);

	let predictions = [];
	let success = false;
	let moment = deadline;
	let score = 0;
	let normalizedScore = 0;
	while (true) {
		testLastActivity = addActivity(testLastActivity, testActivities, testFutureActivities, clusterModelDict, testPredictionModelDict);

		if (testLastActivity.activity === deadline) {
			break;
		}

		const testLastActivityClusterIdx = prediction.getClusterIdx(testLastActivity, clusterModelDict[testLastActivity.activity]);
		const testLastActivityKey = testLastActivity.activity + "_" + testLastActivityClusterIdx;

		// if (predictions.length > 0) {
		// 	log.d(`Next: ${testLastActivityKey}, where the prediction was: ${predictions[0].key}`);
		// }

		const predictionIdx = predictions.slice(0, 1).map(prediction => prediction.key).indexOf(testLastActivityKey);
		if (predictions.length > 0 && predictionIdx !== -1) {
			moment = predictions[predictionIdx].key;
			//moment = predictions[predictionIdx].key.split("_")[0];
			score = predictions[predictionIdx].score;
			normalizedScore = predictions[predictionIdx].defaultScore;
			success = true;
			break;
		}

		const predictionObject = prediction.findMoment(testLastActivity, clusterModels, predictionModels, clusterCount, clusterModelDict[deadline], userValues, getScoringFunction(scenarioParameters.m, scenarioParameters.n));
		predictions = predictionObject.scores;
	}

	return {
		success: success,
		score: score,
		normalizedScore: normalizedScore,
		moment: moment,
	};
}

/**
 * @param users				{Array.<string>} 					Array of user ids
 * @param userActivities	{Object.<string, Array<activity>>}	Dictionary of activity entries per user
 *
 * @returns 				{Object.<string, number>}			Dictionary mapping each activity to a value;
 */
module.exports.run = function(users, userActivities) {
	const results = [];

	const scenarios = {
		onlyTime: {m: 0, n: 1},
		onlyValue: {m: 1, n: 0},
		default: {m: 1, n: 1},
	};

	const deadlines = [
		'sleep',
		'outdoors',
	];

	/* START General testing per user */
	users.forEach(user => {
		// Prepare activities
		log.i("TESTS: Preparing activities");
		const splitActivitiesObject = splitActivities(userActivities[user]);
		const activities = splitActivitiesObject.training;
		const futureActivities = splitActivitiesObject.testing;

		// Calculate clusters based on the training activities
		log.i("TESTS: Calculating clusters");
		const clusterModels = [];
		const clusterModelDict = {};
		let clusterCount = 0;
		const activitiesDict = util.groupBy(activities, 'activity');
		Object.keys(activitiesDict).forEach(activityName => {
			log.d("TESTS: Calculating clusters: " + activityName);
			const clusters = prediction.calculateClusters(activitiesDict[activityName]);
			const clusterModel = {
				user: user,
				activity: activityName,
				model: clusters.model
			};
			clusterCount += clusters.model.numClusters;
			clusterModels.push(clusterModel);
			clusterModelDict[activityName] = clusterModel;
		});

		// Calculate prediction models
		log.i("TESTS: Calculating prediction models");
		const predictionModels = prediction.calculatePredictionModels(activities, clusterModels);

		// Find last activity and corresponding cluster
		let lastActivity = activities[activities.length - 1];

		// Check for each deadline
		deadlines.forEach(deadline => {
			// Copy all data that is bound to change (d means copy per deadline)
			const dActivities = extend(true, [], activities);
			const dFutureActivities = extend(true, [], futureActivities);
			const dPredictionModels = extend(true, [], predictionModels);
			const dPredictionModelDict = util.arrToDict(dPredictionModels, "activity");
			let dLastActivity = extend(true, {}, lastActivity);

			// Keep looping until there are no more testing activities
			// We put this in a try loop to catch
			while (true) {
				try {
					// Fast-forward to after next instance of deadline
					// Note: because the dataset contains some quick successions with only 1 or 2 activities in between
					// We are looking for the last one of these successive activities as a start
					let noSuccessiveFlag = false;
					let first = true;
					while (dLastActivity.activity !== deadline || !noSuccessiveFlag) {
						// check if actually enough future activities
						if (dFutureActivities.length < 4) {
							throwEmptyActivityListError();
						}

						// "Execute" activity (except for the first time, then we just check)
						if (!first) {
							dLastActivity = addActivity(dLastActivity, dActivities, dFutureActivities, clusterModelDict, dPredictionModelDict);
						} else {
							first = false;
						}

						// Check for possible successive activities
						if (dLastActivity.activity === deadline &&
							dFutureActivities[0].activity !== deadline &&
							dFutureActivities[1].activity !== deadline &&
							dFutureActivities[2].activity !== deadline) {
							noSuccessiveFlag = true;
						}
					}

					// x random runs
					const numberOfRuns = 100;
					for(let i = 1; i <= numberOfRuns; i++) {
						const testUserValues = Object.keys(activitiesDict).reduce((map, activityName) => {
							map[activityName] = getRandomUserValue();
							return map;
						}, {});

						const result = {
							user: user,
							deadline: deadline,
							scores: {},
							normalizedScores: {},
							moments: {},
							userValues: testUserValues
						};

						// Check the various scenarios
						Object.keys(scenarios).forEach(scenario => {
							const scenarioParameters = scenarios[scenario];
							let scenarioResult = getResultsForScenario(scenarioParameters, deadline, dLastActivity, dActivities, dFutureActivities, dPredictionModels, clusterCount, clusterModels, clusterModelDict, testUserValues);

							result.scores[scenario] = scenarioResult.score;
							result.normalizedScores[scenario] = scenarioResult.normalizedScore;
							result.moments[scenario] = scenarioResult.moment;
							//result.scenarios[scenario] = scenarioResult; // For detailed results
							//log.d(`TESTS: ${scenarioResult.success ? 'Success' : 'Fail'}`)
						});

						results.push(result);
						log.d(`TESTS: Running test ${i}/${numberOfRuns}`)
					}

					// Skip to the next section
					dLastActivity = addActivity(dLastActivity, dActivities, dFutureActivities, clusterModelDict, dPredictionModelDict);
					log.d(`TESTS: Future activities remaining: ${dFutureActivities.length}`)

				} catch (e) {
					if (e.name === "EmptyActivityListError") {
						break;
					} else {
						throw e;
					}
				}
			}
		});
	});
	/* END General testing per user */

	return results;
};