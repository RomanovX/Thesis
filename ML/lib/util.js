/**
 * @param arr			{Array.<Object>} 		Array of objects
 * @param key			{String}				Object key that links to new unique identifyer
 *
 * @returns 			{Object<String, Object>}	Dictionary
 */

module.exports.arrToObj = function(arr, key) {
	arr.reduce(function(map, obj) {
		map[obj[key]] = obj;
		return map;
	}, {});
};