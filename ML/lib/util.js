/**
 * @param arr			{Array.<Object>} 		Array of objects
 * @param key			{String}				Object key that links to new unique identifyer
 *
 * @returns 			{Object<String, Object>}	Dictionary
 */

module.exports.arrToObj = function(arr, key) {
	return arr.reduce(function(map, obj) {
		map[obj[key]] = obj;
		return map;
	}, {});
};

module.exports.assert2dArray = function(array1, array2) {
	if (!Array.isArray(array1) && !Array.isArray(array2)) {
		return Math.abs(array1 - array2) < 0.00000000001
	}

	if (array1.length !== array2.length) {
		return false;
	}

	for (let i = 0, len = array1.length; i < len; i++) {
		if (!module.exports.assert2dArray(array1[i], array2[i])) {
			return false;
		}
	}

	return true;
};