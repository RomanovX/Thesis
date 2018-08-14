const express = require('express');
const router = express.Router();
const qs = require('query-string');
const {await, fiber, defer} = require('synchronize');

const log = require('../lib/log');
const Activity = require('../models/activity');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}]});
});

router.post('/', function(req, res, next) {
	fiber(() => {
		// TODO: don't resubmit upon refresh
		if(!req.body) {
			res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}], uploaded: true, upload_error: 'Body missing'});
		}

		if(!req.body.activity || !req.body.startingDate || !req.body.startingTime || !req.body.duration) {
			res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}], uploaded: true, upload_error: 'Missing one or more properties. Make sure they are all filled in.'});
		}

		// TODO: this does not handle timezone differences
		const startingDateTime = new Date(req.body.startingDate + " " + req.body.startingTime);

		const act = new Activity({
			activity: req.body.activty,
			start: startingDateTime,
			duration: req.body.duration
		});

		var activity = await(act.save(defer()));

		res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}], uploaded: true, upload_error: false});
	}, (err) => {
		if(err) {
			log.e(err);
			res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}], uploaded: true, upload_error: err});
		}
	});
});

module.exports = router;
