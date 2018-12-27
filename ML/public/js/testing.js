$(document).ready(function() {
	const predictSpinner = $('#predictSpinner').hide();
	const momentSpinner = $('#momentSpinner').hide();
	const transitionSpinner = $('#transitionSpinner').hide();

	$('#predict').click(function(e) {
		e.preventDefault();
		$('#status').text("");
		const user = $('#user').val();
		$.ajax({
			type: 'get',
			url: `api/v1/activity/next?user=${user}`,
			beforeSend: function() {
				predictSpinner.show();
			},
			complete: function() {
				predictSpinner.hide();
			},
			success: function(xhr) {
				$('#status').text("Your next activity is predicted to be:\n" + JSON.stringify(xhr))
			},
			error: function(xhr) {
				$('#status').text("Error getting prediction: " + (xhr.responseText || xhr.statusText))
			},
		});
	});

	$('#transition').click(function(e) {
		e.preventDefault();
		$('#status').text("");
		const user = $('#user').val();
		$.ajax({
			type: 'get',
			url: `api/v1/transition?user=${user}`,
			beforeSend: function() {
				transitionSpinner.show();
			},
			complete: function() {
				transitionSpinner.hide();
			},
			success: function(xhr) {
				$('#status').text("Your transitionMatrix is:\n" + JSON.stringify(xhr))
			},
			error: function(xhr) {
				$('#status').text("Error getting moment: " + (xhr.responseText || xhr.statusText))
			},
		});
	});

	$('#moment').click(function(e) {
		e.preventDefault();
		$('#status').text("");
		const user = $('#user').val();
		const activity = $('#activity').val();
		$.ajax({
			type: 'get',
			url: `api/v1/moment?user=${user}&activity=${activity}`,
			beforeSend: function() {
				momentSpinner.show();
			},
			complete: function() {
				momentSpinner.hide();
			},
			success: function(xhr) {
				$('#status').text("Your ideal moment would be:\n" + JSON.stringify(xhr))
			},
			error: function(xhr) {
				$('#status').text("Error getting moment: " + (xhr.responseText || xhr.statusText))
			},
		});
	});
});