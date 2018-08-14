const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');

const log = require('../lib/log');
const Activity = require('../models/activity');

/* GET home page. */

router.delete('/activity', function(req, res, next) {
	fiber(() => {
		Activity.collection.drop();
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to clear activity database: ' + err.message);
		}
	});
});

router.get('/activity', function(req, res, next) {
	fiber(() => {
		const count = await(Activity.count({}, defer()));
		res.status(200).send({count: count});
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to get activity statistics: ' + err.message);
		}
	});
});

router.post('/activity', function(req, res, next) {
	fiber(() => {
		// TODO: don't resubmit upon refresh
		// TODO: proper status codes
		if(!req.body) {
			res.send(400);
		}

		if(!req.body.activity || !req.body.startingDate || !req.body.startingTime || !req.body.duration) {
			res.send(400);
		}

		// TODO: this does not handle timezone differences
		const startingDateTime = new Date(req.body.startingDate + " " + req.body.startingTime);

		const act = new Activity({
			activity: req.body.activity,
			start: startingDateTime,
			duration: req.body.duration
		});

		await(act.save(defer()));

		res.send(200)
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send('Failed to process activity: ' + err.message);
		}
	});
});

module.exports = router;
