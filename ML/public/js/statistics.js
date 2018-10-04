function refreshCounters() {
	function count(options) {
		const $this = $(this);
		options = $.extend({}, options || {}, $this.data('countToOptions') || {});
		$this.countTo(options);
	}

	$.ajax({
		type: 'GET',
		url: 'api/v1/activity',
		success: function(res) {
			$('#totalCount').attr("data-to", res.count||0);
			$('#activitiesCount').attr("data-to", res.unique||0);
			$('.timer').each(count);
		},
		error: function(xhr, status, error) {
			$('.timer').attr("data-to", 0)
		},
	});
}

$(document).ready(function() {
	refreshCounters();

	$('#clearDB').click(function() {
		$.ajax({
			type: 'DELETE',
			url: 'api/v1/activity',
			success: function() {
				window.location.reload();
			}
		});
	})
});