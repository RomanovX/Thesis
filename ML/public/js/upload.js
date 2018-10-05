//TODO: clear forms when done uploading

$(document).ready(function() {
	const today = new Date();
	const time = ("0" + today.getHours()).slice(-2) + ":" + ("0" + today.getMinutes()).slice(-2);

	document.getElementById('startDate').value = today.toISOString().slice(0, 10);
	document.getElementById('endDate').value = today.toISOString().slice(0, 10);

	document.getElementById('startTime').value = document.getElementById('endTime').value = time;


	$('#uploadForm').submit(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: 'api/v1/activities',
			data: $(this).serialize(),
			success: function() {
				$('#uploadStatus').text("Your activity was successfully uploaded!")
			},
			error: function(xhr, status, error) {
				$('#uploadStatus').text("Error! Your activity was not uploaded. Error message: " + (xhr.responseText || xhr.statusText))
			},
		});
	});

	$('#uploadFile').submit(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: 'api/v1/activities/bulk',
			data: new FormData($(this)[0]),
			cache: false,
			contentType: false,
			processData: false,
			success: function() {
				$('#uploadStatus').text("Your activity file was successfully uploaded!")
			},
			error: function(xhr, status, error) {
				$('#uploadStatus').text("Error! Your activity file was not uploaded. Error message: " + (xhr.responseText || xhr.statusText))
			},
		});
	});
});

