//TODO: clear forms when done uploading

$(document).ready(function() {
	const st1 = $('#status1');
	const st2 = $('#status2');

	$('#load').click(function(e) {
		e.preventDefault();
		st1.text("");
		st2.text("");
		const user = $('#user').val();
		let callCounter = 0;
		let activities = [];
		let values = {};
		function populateForm() {
			if (callCounter < 2) {
				return;
			}

			activities.forEach(activity => {
				if (!(activity in values)) {
					values[activity] = 3; // Middle value
				}
			});

			//TODO: Populate form
		}

		$.ajax({
			type: 'get',
			url: `api/v1/users/${user}`,
			success: function(xhr) {
				if (!xhr) {
					st1.text("No stored user data yet. Loading default profile.");
				} else {
					st1.text("Successfully loaded user values");
					values = xhr.values;
				}
				callCounter++;
				populateForm();
			},
			error: function(xhr) {
				st1.text("Error getting user values: " + (xhr.responseText || xhr.statusText))
			},
		});
		$.ajax({
			type: 'get',
			url: `api/v1/clustermodels?user=${user}`,
			success: function(xhr) {
				if (!xhr) {
					st2.text("This user has no recorded activities");
					return;
				}
				st2.text("Successfully loaded user activities");
				callCounter++;
				activities = xhr.map(model => model.activity);
				populateForm();
			},
			error: function(xhr) {
				st2.text("Error getting user activities: " + (xhr.responseText || xhr.statusText))
			},
		});
	});

	$('#uploadFile').submit(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: 'api/v1/activities/bulk',
			data: new FormData(this),
			cache: false,
			contentType: false,
			processData: false,
			success: function() {
				$('#status1').text("Your activity file was successfully uploaded!")
			},
			error: function(xhr, status, error) {
				$('#status1').text("Error! Your activity file was not uploaded. Error message: " + (xhr.responseText || xhr.statusText))
			},
		});
	});
});

