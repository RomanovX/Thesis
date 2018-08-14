const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { page: 'Home'});
});

router.get('/statistics', function(req, res, next) {
	res.render('statistics', { page: 'Statistics', stylesheets: [{stylesheet: '/stylesheets/statistics.css'}], scripts: [{script: '/js/counter.js'}]});
});

router.get('/about', function(req, res, next) {
	res.render('about', { page: 'About'});
});

module.exports = router;
