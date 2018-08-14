const express = require('express');
const router = express.Router();
const {await, fiber, defer} = require('synchronize');

const log = require('../lib/log');
const Activity = require('../models/activity');

/* GET home page. */

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

		throw new Error('blabla')
		// TODO: this does not handle timezone differences
		const startingDateTime = new Date(req.body.startingDate + " " + req.body.startingTime);

		const act = new Activity({
			activity: req.body.activity,
			start: startingDateTime,
			duration: req.body.duration
		});

		var activity = await(act.save(defer()));

		res.send(200)
	}, (err) => {
		if(err) {
			log.e(err);
			res.status(500).send(err.message);
		}
	});
});

module.exports = router;
