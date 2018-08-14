

$(document).ready(function() {
	const today = new Date();
	document.getElementById('startingDate').value = today.toISOString().slice(0, 10);
});