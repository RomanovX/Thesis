function refreshCounters() {
	function count(options) {
		const $this = $(this);
		options = $.extend({}, options || {}, $this.data('countToOptions') || {});
		$this.countTo(options);
	}

	$.ajax({
		type: 'GET',
		url: 'api/v1/activities',
		success: function(res) {
			$('#totalCount').attr("data-to", res.count||0).each(count);
			$('#activitiesCount').attr("data-to", res.unique||0).each(count);
		},
		error: function(xhr, status, error) {
			// Do nothing
		},
	});

	$.ajax({
		type: 'GET',
		url: 'api/v1/clusters',
		success: function(res) {
			$('#clusterCount').attr("data-to", res.length||0).each(count);
		},
		error: function(xhr, status, error) {
			// Do nothing
		},
	});
}

$(document).ready(function() {
	refreshCounters();

	$('#clearDB').click(function() {
		$.ajax({
			type: 'DELETE',
			url: 'api/v1/activities',
			success: function() {
				window.location.reload();
			}
		});
	});

	const spinner = $('#spinner').hide();

	$('#resetClusters').click(function() {
		$.ajax({
			type: 'post',
			url: 'api/v1/clusters',
			beforeSend: function() {
				spinner.show();
			},
			complete: function() {
				spinner.hide();
			},
			success: function() {
				window.location.reload();
			}
		});
	})
});