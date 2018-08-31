const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');
const x2j = require('xml2json');
const fs = require('fs');

const log = require('../lib/log');
const Activity = require('../models/activity');

/* GET home page. */

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
		const count = await(Activity.countDocuments({}, defer()));
		const activities = await(Activity.distinct('activity', defer())).length;
		res.status(200).send({count: count, activities: activities});
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity statistics: ' + err.message);
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
				entries = json.log.trace.reduce((acts, trace) => {
					return acts.concat(trace.event.map(event => {
						return {
							activity: event.string[0].value,
							date: new Date(event.date.value),
							status: new Date(event.string[1].value)
						};
					}))
				}, []);

				if(entries.length % 2 !== 0) {
					throw new Error("Not every activity has a start and an end entry");
				}

				entries.sort((a,b) => a.date - b.date);

				for (let i = 0, l = entries.length; i < l-1; i+=2) {
					if(entries[i].name === "Start" || entries[i] === "End") {
						continue;
					}

					if(entries[i].string[0].value !== entries[i+1].string[0].value
						|| entries[i].string[1].value !== "start"
						|| entries[i+1].string[1].value !== "complete") {
						throw new Error("Not every activity has a start and an end entry")
					}

					activities.push({
						activity: name,
						start: new Date(entries[i].date.value),
						end: new Date(entries[i+1].date.value)
					})
				}
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

module.exports = router;
