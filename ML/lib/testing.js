const prediction = require('./prediction');
const util = require('./util');
const log = require('./log');

const extend = require('extend');

function getScoringFunction(m, n) {
	return function (value, steps) {
		return (value**m)/(steps**n);
	}
}

/**
 * @param activities	{Array.<activity>} 	Array of activities
 *
 * @returns 			{{training: Array<activity>, testing: Array<activity>}}
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
	// if (!predictionModel.nextClusters[lastClusterIdx]) {
	// 	predictionModel.nextClusters[lastClusterIdx] = {};
	// }

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
 * @param type			{string} 	Type of test
 * @param activityName	{string}	Activity name
 * @param userValues	{Object.<string, number>>} Dictionary of user values per activity
 *
 * @returns 			{Object.<string, number>}	Dictionary mapping each activity to a value;
 */
function testingUserValues(type, activityName, userValues) {
	const defaultValue = 2;
	switch (type) {
		case 'valueIndependent':
			return defaultValue;
		case 'random':
			return Math.floor(Math.random() * 4);
		case 'onlyToilet':
			return (activityName === 'toilet') ? defaultValue : 0;
		case 'userValues':
			return userValues[activityName];
		default:
			throw Error("Unknown type selected");
	}
}

function throwEmptyActivityListError() {
	throw {
		name: 'EmptyActivityListError',
		message: 'No remaining activities'
	};
}

/**
 * @param users				{Array.<string>} 					Array of user ids
 * @param userActivities	{Object.<string, Array<activity>>}	Dictionary of activity entries per user
 * @param userValues		{Object.<string, Object.<string, number>>}	Dictionary of values per user
 *
 * @returns 				{Object.<string, number>}			Dictionary mapping each activity to a value;
 */
module.exports.run = function(users, userActivities, userValues) {
	/* Scenarios:
	 *	 - Different user values:
	 *	   - valueIndependent: all default
	 *	   - random
	 *	   - onlyToilet: all 0,
	 *   - several values of m
	 *   - several values of n
	 *   - different deadline activity (sleeping / outdoors)
	 *
	 *   - Use 2 users combined for testing the 3rd?
	 */

	const results = [];

	const scenarios = [
		'valueIndependent',
		'random',
		'onlyToilet',
		'userValues',
	];

	const deadlines = [
		'sleep',
		'outdoor',
	];


	/* START General testing per user */
	try {
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
			const predictionModelDict = util.arrToDict(predictionModels, 'activity');

			// Find last activity and corresponding cluster
			let lastActivity = activities[activities.length - 1];


			// Check for each deadline
			deadlines.forEach(deadline => {
				// Keep looping until there are no more testing activities
				// We put this in a try loop to catch
				while (true) {
					try {
						// Fast-forward to after next instance of deadline
						// Note: because the dataset contains some quick successions with only 1 or 2 activities inbetween
						// We are looking for the last one of these successive activities as a start
						let noSuccessiveFlag = false;
						let first = true;
						while (lastActivity.activity !== deadline || !noSuccessiveFlag) {
							// check if actually enough future activities
							if (futureActivities.length < 4) {
								throwEmptyActivityListError();
							}

							// "Execute" activity (except for the first time, then we just check)
							if (!first) {
								lastActivity = addActivity(lastActivity, activities, futureActivities, clusterModelDict, predictionModelDict);
							} else {
								first = false;
							}

							// Check for possible successive activities
							if (lastActivity.activity === deadline &&
								futureActivities[0].activity !== deadline &&
								futureActivities[1].activity !== deadline &&
								futureActivities[2].activity !== deadline) {
								noSuccessiveFlag = true;
							}
						}

						// Loop for various m and n values
						for (let m = 1; m <= 5; m += 0.5) {
							for (let n = 1; n <= 5; n += 0.5) {
								// Check the various scenarios
								scenarios.forEach(scenario => {
									// Copy all data that is bound to change
									const testActivities = extend(true, [], activities);
									const testFutureActivities = extend(true, [], futureActivities);
									const testPredictionModels = extend(true, [], predictionModels);
									const testPredictionModelDict = util.arrToDict(testPredictionModels, "activity");

									let testLastActivity = extend(true, {}, lastActivity);

									const testUserValues = Object.keys(activitiesDict).reduce((map, activityName) => {
										map[activityName] = testingUserValues(scenario, activityName, userValues);
										return map;
									}, {});

									let predictions = [];
									let success = false;
									while (true) {
										testLastActivity = addActivity(testLastActivity, testActivities, testFutureActivities, clusterModelDict, testPredictionModelDict);

										if (testLastActivity.activity === deadline) {
											break;
										}

										const testLastActivityClusterIdx = prediction.getClusterIdx(testLastActivity, clusterModelDict[testLastActivity.activity]);
										const testLastActivityKey = testLastActivity.activity + "_" + testLastActivityClusterIdx;

										if (predictions.indexOf(testLastActivityKey) !== -1) {
											success = true;
											break;
										}

										const scoresObject = prediction.findMoment(testLastActivity, clusterModels, predictionModels, clusterCount, clusterModelDict[deadline], testUserValues, getScoringFunction(m, n));
										const scores = scoresObject.scores;
										predictions = [scores[0].key, scores[1].key, scores[2].key];
									}

									const result = {
										user: user,
										deadline: deadline,
										scenario: scenario,
										values: testUserValues,
										m: m,
										n: n,
										success: success,
									};

									log.d(result);

									results.push(result);

									// Skip to the next section
									lastActivity = addActivity(lastActivity, testActivities, testFutureActivities, clusterModelDict, testPredictionModelDict);
								});
							}
						}
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

		return results;
	} catch (e) {
		return results;
	}

	/* END General testing per user */
};