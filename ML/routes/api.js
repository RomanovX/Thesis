const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');
const x2j = require('xml2json');
const fs = require('fs');

const log = require('../lib/log');
const em = require('../lib/em');
const Activity = require('../models/activity');

router.delete('/activity', function(req, res, next) {
	fiber(() => {
		await(Activity.collection.drop(defer()));
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to clear activity database: ' + err.message);
		}
	});
});

router.get('/activity', function(req, res, next) {
	fiber(() => {
		if (!req.params) {
			const count = await(Activity.countDocuments({}, defer()));
			const activities = await(Activity.distinct('activity', defer()));
			const unique = activities.length;
			res.status(200).send({count: count, activities: activities, unique: unique});
			return;
		}

		const activities = await(Activity.find(req.params, defer()));
		res.status(200).send(activities);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity statistics: ' + err.message);
		}
	});
});

router.get('/activity/:id', function(req, res, next) {
	fiber(() => {
		const activity = await(Activity.findOne({_id: req.params.id}, defer()));
		res.status(200).send(activity);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity: ' + err.message);
		}
	});
});

router.post('/activity', function(req, res, next) {
	fiber(() => {
		// TODO: don't accept duplicate upload
		// TODO: proper status codes
		if(!req.body) {
			res.status(400).send();
		}

		if(!req.body.activity || !req.body.startDate || !req.body.startTime || !req.body.endDate || !req.body.endTime) {
			res.status(400).send();
		}

		// TODO: this does not handle timezone differences
		const startDateTime = new Date(req.body.startDate + " " + req.body.startTime);
		const endDateTime = new Date(req.body.endDate + " " + req.body.endTime);

		const act = new Activity({
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

router.post('/activity/bulk', function(req, res, next) {
	fiber(() => {
		if(!req.files || !req.files.file) {
			res.status(400).send();
		}

		let activities = [];

		// Try xes file
		try {
			const xml = await(fs.readFile(req.files.file.path, defer()));
			const json = x2j.toJson(xml, {
				object: true
			});
			if (json.log && json.log.trace && json.log["xes.version"]) {
				//TODO: now every activity (start and end) is a separate activity
				let entries = json.log.trace.reduce((acts, trace) => {
					return acts.concat(trace.event.map(entry => {
						return {
							activity: entry.string[0].value,
							date: new Date(entry.date.value),
							status: entry.string[1].value
						};
					}))
				}, []);

				if(entries.length % 2 !== 0) {
					throw new Error("Not every activity has a start and an end entry");
				}

				entries.sort((a,b) => a.date - b.date);

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

						event.end = entry.date;
						event.duration = event.end - event.start;
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

router.post('/cluster', function(req, res, next) {
	fiber(() => {
		if (req.body) {
			res.status(500).send('No body expected.');
			return;
		}

		const activities = await(Activity.distinct('activity', defer()));

		const clusters = activities.map(activity => {
			const events = await(Activity.find({activity: activity}, defer()));
			return em.calculateClusters(events);
		});

		res.status(200).send(clusters);
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed calculate clusters: ' + err.message);
		}
	});
});

module.exports = router;
