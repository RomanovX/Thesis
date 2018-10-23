const createError = require('http-errors');
const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const formidable = require('express-formidable');

const db = require('./lib/db');
const log = require('./lib/log');
const config = require('./config');

const basicRouter = require('./routes/basicRoutes');
const apiRouter = require('./routes/api');

const app = express();

db.connection = db.connect(config.mongo, function(err) {
  if (err) {
    log.e(err);
  }
});

db.mongoose.connection.on('error', function(err) {
	log.e(err);
});
db.mongoose.connection.once('open', function() {
	log.d('Successfully established database connection.')
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(favicon(path.join(__dirname, 'public/images/favicon.ico')));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Automatically parsing form data
app.use(formidable());

app.use('/', basicRouter);
app.use('/api/v1', apiRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  //res.render('error');
});

module.exports = app;
