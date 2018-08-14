const winston = require('winston');
const dateFormat = require('dateformat');

// Defining the logging levels
const custLevels = {
	audit: 0,
	error: 1,
	warn: 2,
	info: 3,
	verbose: 4,
	debug: 5,
	silly: 6
};

// The corresponding colors
const custColors = {
	audit: 'magenta',
	error: 'red',
	warn: 'yellow',
	info: 'green',
	verbose: 'cyan',
	debug: 'blue',
	silly: 'gray'
};


// Default settings for the loggers
const logger = new winston.Logger({
	levels: custLevels,
	transports: [
		new (winston.transports.Console)({
			level: 'debug',
			colorize: 'all',
			printPretty: true,
			timestamp: function() {
				return dateFormat(new Date(), 'dd-mm-yy HH:MM:ss');
			}
		})
	]
});

logger.ef = function(file) {
	logger.add(winston.transports.File, {
		filename: file,
		level: 'info',
		timestamp: function() {
			return dateFormat(new Date(), 'dd-mm-yy HH:MM:ss');
		}
	});
};

// Adds colors to the levels
winston.addColors(custColors);

// Checks whether the value exists anywhere in the JSON Object key, value pairs
const hasVal = function(Obj, newVal) {
	for (var key in Obj) {
		if (Obj.hasOwnProperty(key)) {
			if (Obj[key] === newVal) {
				return true;
			}
		}
	}
	return false;
};

// Not done with a for each to allow function complete
logger.s = function(msg, meta, callback) {
	if (msg != null) {
		logger.silly(msg, meta || '', callback || '');
	}
};
logger.d = function(msg, meta, callback) {
	if (msg != null) {
		logger.debug(msg, meta || '', callback || '');
	}
};
logger.v = function(msg, meta, callback) {
	if (msg != null) {
		logger.verbose(msg, meta || '', callback || '');
	}
};
logger.i = function(msg, meta, callback) {
	if (msg != null) {
		logger.info(msg, meta || '', callback || '');
	}
};
logger.w = function(msg, meta, callback) {
	if (msg != null) {
		logger.warn(msg, meta || '', callback || '');
	}
};
logger.e = function(msg, meta, callback) {
	if (msg != null) {
		logger.error(msg, meta || '', callback || '');
	}
};
logger.a = function(msg, meta, callback) {
	if (msg != null) {
		logger.audit(msg, meta || '', callback || '');
	}
};


// Allows addition of a new logging level. Note that this can also be used to change
// the priority of an existing level.
//
// The new logger level has to be called logger.log("name", "msg", {meta});
logger.addLevel = function(name, color, higher_level, lower_level) {
	var level1 = logger.levels[higher_level],
		level2 = logger.levels[lower_level],
		newLev;

	do {
		newLev = Math.min(level1, level2) + (Math.abs(level1 - level2)) / 2;
		level2 = newLev;
	} while (hasVal(logger.levels, newLev) === true);

	logger.levels[name] = newLev;
	custColors[name] = color;

	// Add color to the new levels
	winston.addColors(custColors);
};

module.exports = logger;