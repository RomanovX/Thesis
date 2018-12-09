$(document).ready(function() {
	const predictSpinner = $('#predictSpinner').hide();
	const momentSpinner = $('#momentSpinner').hide();

	$('#predict').click(function(e) {
		e.preventDefault();
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

	$('#moment').click(function(e) {
		e.preventDefault();
		const user = $('#user').val();
		$.ajax({
			type: 'get',
			url: `api/v1/moment?user=${user}`,
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
	})
});