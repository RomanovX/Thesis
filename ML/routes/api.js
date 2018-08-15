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

		var xml = await(fs.readFile(req.files.file.path, defer()));
		var json = x2j.toJson(xml, {
			object: true
		});
		res.status(200).send();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get process bulk activity file: ' + err.message);
		}
	});
});

module.exports = router;
