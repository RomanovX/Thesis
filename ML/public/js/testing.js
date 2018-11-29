$(document).ready(function() {
	const spinner = $('#spinner').hide();

	$('#predict').submit(function(e) {
		e.preventDefault();
		$.ajax({
			type: 'post',
			url: 'api/v1/predict',
			data: $(this).serialize(),
			beforeSend: function() {
				spinner.show();
			},
			complete: function() {
				spinner.hide();
			},
			success: function() {
				$('#predictStatus').text("Your next activity is predicted to be: ..........")
			},
			error: function(xhr) {
				$('#predictStatus').text("Error generating prediction. Error message: " + (xhr.responseText || xhr.statusText))
			},
		});
	})
});