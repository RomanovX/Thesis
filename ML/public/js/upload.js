

$(document).ready(function() {
	const today = new Date();
	document.getElementById('startingDate').value = today.toISOString().slice(0, 10);

	$('#uploadForm').submit(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'POST',
			url: 'api/v1/activity',
			data: $(this).serialize(),
			success: function() {
				$('#uploadStatus').text("Your activity was successfully uploaded!")
			},
			error: function(xhr, status, error) {
				$('#uploadStatus').text("Error! Your activity was not uploaded. Error message: " + (xhr.responseText || xhr.statusText))
			},
		})

	})
});

