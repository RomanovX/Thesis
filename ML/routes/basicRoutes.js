const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { page: 'Home'});
});

router.get('/statistics', function(req, res, next) {
	res.render('statistics', { page: 'Statistics', stylesheets: [{stylesheet: '/stylesheets/statistics.css'}], scripts: [{script: '/js/counter.js'}, {script: '/js/statistics.js'}]});
});

router.get('/about', function(req, res, next) {
	res.render('about', { page: 'About'});
});

router.get('/testing', function(req, res, next) {
	res.render('testing', { page: 'Testing', scripts: [{script: '/js/testing.js'}]});
});

router.get('/upload', function(req, res, next) {
	res.render('upload', { page: 'Upload', scripts: [{script: '/js/upload.js'}]});
});

router.get('/values', function(req, res, next) {
	res.render('values', { page: 'Values', scripts: [{script: '/js/values.js'}], stylesheets: [{stylesheet: '/stylesheets/values.css'}]});
});

router.get('/docs', function(req, res, next) {
	res.render('docs', { page: 'Documentation'});
});

router.get('/docs/:chapter', function(req, res, next) {
	const chapter = req.params.chapter;
	res.render('chapter', { chapter: chapter});
});

router.get('/snippets/:snippet', function(req, res, next) {
	const snippet = req.params.snippet;
	res.render("snippet_" + snippet);
});

module.exports = router;
