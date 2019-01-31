const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');
const x2j = require('xml2json');
const fs = require('fs');
const formidable = require('express-formidable');

const log = require('../lib/log');
const prediction = require('../lib/prediction');
const testing = require('../lib/testing');
const Activity = require('../models/activity');
const Cluster = require('../models/cluster');
const User = require('../models/user');
const ClusterModel = require('../models/clusterModel');
const PredictionModel = require('../models/predictionModel');

t

function calculateForUser(user) {
	let clusters = [], clusterModels = [];

	log.i(`Calculating clusters for user: ${user}`);
	const userClusterModels = [];
	const activityNames = await(Activity.distinct('activity', {user: user}, defer()));
	activityNames.forEach(activity => {
		log.v(`Processing activity: ${activity}`);
		const entries = await(Activity.find({user: user, activity: activity}, defer()));
		const result = prediction.calculateClusters(entries);
		result.clusters.forEach((cluster, i) => {
			const newCluster = {
				user: user,
				activity: activity,
				parameters: cluster,
				duration: result.durations[i],
			};
			clusters.push(newCluster);
		});

		const newClusterModel = {
			user: user,
			activity: activity,
			model: result.model
		};
		userClusterModels.push(newClusterModel);
		clusterModels.push(newClusterModel);
	});

	log.i(`Calculating prediction models`);
	const userActivities = await(Activity.find({user: user}).sort({start: 1}).exec(defer()));
	const predictionModels = prediction.calculatePredictionModels(userActivities, userClusterModels);

	return [clusters, clusterModels, predictionModels];
}

function normalizeDate(dateString) {
	const date = new Date(dateString);
	const timezoneOffset = date.getTimezoneOffset() * 60000;
	return date - timezoneOffset;
}

// TODO: Rewrite all per user
router.get('/activities', function(req, res, next) {
	fiber(() => {
		// If there are no query parameters sent, send the number and unique types of activities back
		if (!req.params || (Object.keys(req.params).length === 0 && req.params.constructor === Object)) {
			const count = await(Activity.countDocuments({}, defer()));
			const activities = await(Activity.distinct('activity', defer()));
			const unique = activities.length;
			res.status(200).send({count: count, activities: activities, unique: unique});
			return;
		}

		// Else, do a search with the parameters (note: not checking which parameters is an unsafe approach)
		const activities = await(Activity.find(req.params, defer()));
		res.status(200).send(activities);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity statistics: ' + err.message);
		}
	});
});

router.get('/activities/:id', function(req, res, next) {
	fiber(() => {
		// Return the details of the specific activity (by id)
		const activity = await(Activity.findOne({_id: req.params.id}, defer()));
		res.status(200).send(activity);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity: ' + err.message);
		}
	});
});

router.post('/activities', function(req, res, next) {
	fiber(() => {
		// TODO: don't accept duplicate upload
		// TODO: proper status codes
		if(!req.body) {
			res.status(400).send();
			return;
		}

		if(!req.body.activity || !req.body.startDate || !req.body.startTime || !req.body.endDate || !req.body.endTime || !req.body.user) {
			res.status(400).send();
			return;
		}

		// TODO: this does not handle timezone differences
		const startDateTime = normalizeDate(req.body.startDate + " " + req.body.startTime);
		const endDateTime = normalizeDate(req.body.endDate + " " + req.body.endTime);

		const act = new Activity({
			user: req.body.user,
			activity: req.body.activity,
			start: startDateTime,
			end: endDateTime,
			duration: Math.round((endDateTime - startDateTime) / 1000)
		});

		await(act.save(defer()));

		const clusterModel = await(ClusterModel.findOne({user: req.body.user, activity: req.body.activity}, defer()));
		let clusterKey = "No cluster model for this activity yet.";
		if (clusterModel) {
			const clusterIdx = prediction.getClusterIdx(req.body.activity, clusterModel);
			clusterKey = req.body.activity + "_" + clusterIdx;
		}

		res.status(200).send({cluster: clusterKey});
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to process activity: ' + err.message);
		}
	});
});

router.post('/activities/bulk', formidable({multiples: true}), function(req, res, next) {
	fiber(() => {
		if(!req.files || !req.files.file || req.files.file.size === 0 || !req.fields || req.fields.user === "") {
			res.status(400).send();
			return;
		}

		const user = req.fields.user;

		req.files.file.forEach(file => {
			let activities = [];

			// Try xes file
			try {
				const xml = await(fs.readFile(file.path, defer()));
				const json = x2j.toJson(xml, {
					object: true
				});
				if (json.log && json.log.trace && json.log["xes.version"]) {
					let entries = json.log.trace.reduce((acts, trace) => {
						return acts.concat(trace.event.map(entry => {
							return {
								activity: entry.string[0].value,
								date: normalizeDate(entry.date.value),
								status: entry.string[1].value
							};
						}))
					}, []);

					if(entries.length % 2 !== 0) {
						throw new Error("Not every activity has a start and an end entry");
					}

					//entries.sort((a,b) => a.date - b.date);

					// First store the starting and only move to the final store upon also completed
					const startingEntries = [];

					entries.forEach(entry => {
						if(entry.activity === "Start" || entry.activity === "End") {
							return;
						}

						if (entry.status === "start") {
							startingEntries.push({
								user: user,
								activity: entry.activity,
								start: entry.date
							})
						}

						if (entry.status === "complete") {
							const event = startingEntries.find(startingEntry => startingEntry.activity === entry.activity);

							if (!event) {
								throw new Error("Not every activity has a start and an end entry");
							}

							// remove from the array
							startingEntries.splice(startingEntries.indexOf(event), 1);

							event.end = entry.date;
							event.duration = Math.round((event.end - event.start) / 1000);
							activities.push(event);
						}
					});
				}
			} catch (err) {
				res.status(400).send('Failed to process bulk activity file: ' + err.message);
				activities = [];
			}

			await(Activity.insertMany(activities, defer()));
		});


		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to process bulk activity file: ' + err.message);
		}
	});
});

router.delete('/activities', function(req, res, next) {
	fiber(() => {
		await(Activity.remove({}, defer()));
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to clear activity database: ' + err.message);
		}
	});
});

router.get('/users/:id', function(req, res, next) {
	fiber(() => {
		// Return the details of the specific user (by id)
		const user = await(User.findOne({id: req.params.id}, defer()));
		res.status(200).send(user);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get user: ' + err.message);
		}
	});
});

router.get('/users', function(req, res, next) {
	fiber(() => {
		const users = await(User.find({}, defer()));
		res.status(200).send(users);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get users: ' + err.message);
		}
	});
});

router.post('/users/:id', function(req, res, next) {
	fiber(() => {
		if (!req.body || (Object.keys(req.body).length === 0)) {
			res.status(400).send('Body expected.');
			return;
		}

		let user = await(User.findOne({id: req.params.id}, defer()));
		if (!user) {
			user = new User({
				id: req.params.id,
			});
		}
		user.values = req.body;

		await(user.save(defer()));
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to save user: ' + err.message);
		}
	});
});

router.delete('/users', function(req, res, next) {
	fiber(() => {
		await(User.remove({}, defer()));
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to clear user database: ' + err.message);
		}
	});
});

router.get('/clustermodels', function(req, res, next) {
	fiber(() => {
		const query = {};
		if (req.query && req.query.user) {
			query.user = req.query.user;
		}
		const clusterModels = await(ClusterModel.find(query, defer()));
		res.status(200).send(clusterModels);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get cluster models: ' + err.message);
		}
	});
});

router.get('/clusters', function(req, res, next) {
	fiber(() => {
		const clusters = await(Cluster.find({}, defer()));
		res.status(200).send(clusters);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get clusters: ' + err.message);
		}
	});
});

// TODO: This should be a different endpoint or something, because like this it isn't restful
router.post('/clusters', function(req, res, next) {
	fiber(() => {
		if (req.body && !(Object.keys(req.body).length === 0 && req.body.constructor === Object)) {
			res.status(400).send('No body expected.');
			return;
		}

		// Storage arrays for data spanning all users
		let clusters = [];
		let clusterModels = [];
		let predictionModels = [];

		const users = await(Activity.distinct('user', defer()));
		users.forEach(user => {
			let [userClusters, userClusterModels, userPredictionModels] = calculateForUser(user);

			clusters = clusters.concat(userClusters);
			clusterModels = clusterModels.concat(userClusterModels);
			predictionModels = predictionModels.concat(userPredictionModels);
		});

		// Clear all existing data and write newly calculated data.
		await(Cluster.remove({}, defer()));
		await(Cluster.insertMany(clusters, defer()));

		await(ClusterModel.remove({}, defer()));
		await(ClusterModel.insertMany(clusterModels, defer()));

		await(PredictionModel.remove({}, defer()));
		await(PredictionModel.insertMany(predictionModels, defer()));

		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to calculate clusters: ' + err.message);
		}
	});
});

router.delete('/clusters', function(req, res, next) {
	fiber(() => {
		await(Cluster.remove({}, defer()));
		await(ClusterModel.remove({}, defer()));
		await(PredictionModel.remove({}, defer()));
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to clear activity database: ' + err.message);
		}
	});
});

router.get('/activity/next', function(req, res, next) {
	fiber(() => {
		if (!req.query || !req.query.user) {
			res.status(400).send('Missing user');
			return;
		}
		const user = req.query.user;
		const lastActivity = await(Activity.findOne({user: user}).sort({start: -1}).exec(defer()));
		if (!lastActivity) {
			throw new Error('This user has no activities yet');
		}
		const clusterModel = await(ClusterModel.findOne({user: user, activity: lastActivity.activity}, defer()));
		const predictionModel = await(PredictionModel.findOne({user: user, activity: lastActivity.activity}, defer()));
		if(!clusterModel || !predictionModel) {
			throw new Error('First calculate cluster');
		}
		const nextActivities = prediction.predict(lastActivity, clusterModel, predictionModel);

		if (!nextActivities) {
			res.status(400).send('Not enough data to make a prediction');
			return;
		}

		res.status(200).send(nextActivities);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to predict next activity: ' + err.message);
		}
	});
});

router.get('/transition', function(req, res, next) {
	fiber(() => {
		if (!req.query || !req.query.user) {
			res.status(400).send('Missing user');
			return;
		}
		const user = req.query.user;

		const lastActivity = await(Activity.findOne({user: user}).sort({start: -1}).exec(defer()));
		if (!lastActivity) {
			throw new Error('This user has no activities yet');
		}

		const clusterModel = await(ClusterModel.findOne({user: user, activity: lastActivity.activity}, defer()));
		const predictionModels = await(PredictionModel.find({user: user}, defer()));
		const clusterCount = await(Cluster.countDocuments({user: user}, defer()));
		if(!clusterModel || !predictionModels || !clusterCount) {
			throw new Error('First calculate cluster');
		}

		const transitionMatrix = prediction.findTransition(lastActivity, clusterModel, predictionModels, clusterCount);

		res.status(200).send(transitionMatrix);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to predict next activity: ' + err.message);
		}
	});
});

router.get('/moment', function(req, res, next) {
	fiber(() => {
		if (!req.query || !req.query.user || !req.query.activity) {
			res.status(400).send('Missing user or final activity');
			return;
		}
		const userId = req.query.user;
		const finalActivity = req.query.activity;

		const finalModel = await(ClusterModel.findOne({user: userId, activity: finalActivity}, defer()));
		if (!finalModel) {
			res.status(400).send('This activity has not yet been performed by the user.');
			return;
		}

		const lastActivity = await(Activity.findOne({user: userId}).sort({start: -1}).exec(defer()));
		if (!lastActivity) {
			res.status(400).send('This user has no activities yet');
			return;
		}

		if (finalActivity === lastActivity.activity) {
			res.status(200).send('now');
			return;
		}

		const clusterModels = await(ClusterModel.find({user: userId}, defer()));
		const predictionModels = await(PredictionModel.find({user: userId}, defer()));
		const clusterCount = await(Cluster.countDocuments({user: userId}, defer()));
		if(!clusterModels || !predictionModels || !clusterCount) {
			res.status(400).send('First calculate clusters for this user');
			return;
		}

		const user = await(User.findOne({id: userId}, defer()));
		const values = (user) ? user.values : {};
		predictionModels.forEach(model => {
			if (values[model.activity] === undefined) {
				values[model.activity] = 2;
			}
		});

		const [currentKey, scores] = prediction.findMoment(lastActivity, clusterModels, predictionModels, clusterCount, finalModel, values);
		res.status(200).send({currentKey: currentKey, scores: scores});
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to predict next activity: ' + err.message);
		}
	});
});

router.get('/results', function(req, res, next) {
	// TODO: This is not at all optimized
	fiber(() => {
		/* START Preparing data */
		log.i("TESTS: Preparing data");
		// Get users
		const users = await(Activity.distinct('user', defer()));

		// Get activities per user
		const userActivities = users.reduce((acc, userId) => {
			acc[userId] = await(Activity.find({user: userId}).sort({start: 1}).exec(defer()));
			return acc;
		}, {});

		// Get distinct activity names per user
		const userActivityNames = users.reduce((acc, userId) => {
			acc[userId] = await(Activity.distinct('activity', {user: userId}, defer()));
			return acc;
		}, {});

		// // Get values per user (and fill in if missing)
		// const userValues = users.reduce((res, userId) => {
		// 	const user = await(User.findOne({user: userId}, defer()));
		// 	const values = user ? user.values : {};
		//
		// 	userActivityNames[userId].forEach(activityName => {
		// 		if (values[activityName] === undefined) {
		// 			values[activityName] = 2;
		// 		}
		// 	});
		// 	res[userId] = values;
		// 	return res;
		// }, {});

		/* END Preparing data */

		const results = testing.run(users, userActivities);

		await(fs.writeFile( "results.json", JSON.stringify( results ), "utf8", defer()));

		res.status(200).send(results);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to predict next activity: ' + err.message);
		}
	});
});

module.exports = router;
