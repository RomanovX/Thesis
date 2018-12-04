const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');
const x2j = require('xml2json');
const fs = require('fs');

const log = require('../lib/log');
const prediction = require('../lib/prediction');
const util = require('../lib/util');
const Activity = require('../models/activity');
const Cluster = require('../models/cluster');
const ClusterModel = require('../models/clusterModel');
const PredictionModel = require('../models/predictionModel');

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
		const startDateTime = new Date(req.body.startDate + " " + req.body.startTime);
		const endDateTime = new Date(req.body.endDate + " " + req.body.endTime);

		const act = new Activity({
			user: req.body.user,
			activity: req.body.activity,
			start: startDateTime,
			end: endDateTime,
		});

		await(act.save(defer()));

		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to process activity: ' + err.message);
		}
	});
});

router.post('/activities/bulk', function(req, res, next) {
	fiber(() => {
		if(!req.files || !req.files.file || req.files.file.size === 0 || !req.fields || req.fields.user === "") {
			res.status(400).send();
			return;
		}

		let activities = [];

		// Try xes file
		try {
			const xml = await(fs.readFile(req.files.file.path, defer()));
			const json = x2j.toJson(xml, {
				object: true
			});
			if (json.log && json.log.trace && json.log["xes.version"]) {
				let entries = json.log.trace.reduce((acts, trace) => {
					return acts.concat(trace.event.map(entry => {
						return {
							user: req.fields.user,
							activity: entry.string[0].value,
							date: new Date(entry.date.value),
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

// TODO: Rewrite as function per user
router.post('/clusters', function(req, res, next) {
	fiber(() => {
		if (req.body && !(Object.keys(req.body).length === 0 && req.body.constructor === Object)) {
			res.status(400).send('No body expected.');
			return;
		}

		const activityNames = await(Activity.distinct('activity', defer()));
		const users = await(Activity.distinct('user', defer()));

		const clusterArray = [];
		const clusterModelArray = [];

		users.forEach(user => {
			activityNames.forEach(activity => {
				const activities = await(Activity.find({activity: activity}, defer()));
				const result = prediction.calculateClusters(activities);
				result.clusters.forEach((cluster, i) => {
					clusterArray.push({
						user: user,
						activity: activity,
						parameters: cluster,
						duration: result.durations[i],
					})
				});

				clusterModelArray.push({
					user: user,
					activity: activity,
					model: result.model
				});
			});
		});

		await(Cluster.remove({}, defer()));
		await(Cluster.insertMany(clusterArray, defer()));

		await(ClusterModel.remove({}, defer()));
		await(ClusterModel.insertMany(clusterModelArray, defer()));

		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to calculate clusters: ' + err.message);
		}
	});
});


// TODO: Move predictionmodel making directly after clustering
router.post('/predict', function(req, res, next) {
	fiber(() => {
		if (!req.body || !req.body.user) {
			res.status(400).send();
			return;
		}

		const user = req.body.user;

		const activities = await(Activity.find({user: user}).sort({"time":1}).exec(defer()));
		const clusterModels = await(ClusterModel.find({user: user}, defer()));

		const predictionModels = prediction.calculatePredictionModels(activities, clusterModels);

		await(PredictionModel.remove({user: user}, defer()));
		await(PredictionModel.insertMany(Object.values(predictionModels), defer()));


		// prediction

		// const lastActivity = await(Activity.find({user: user}).sort({"time":-1}).limit(1).exec(defer()));
		// const clusterModel = util.arrToObj(clusterModels.find(cm => cm.activity === lastActivity.activity), 'activity');
		// const model = clusterModels.find(cm => cm.activity === lastActivity.activity);
		//
		// util.arrToObj(clusterModels);


		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to predict next activity: ' + err.message);
		}
	});
});

module.exports = router;
