//TODO: clear forms when done uploading
function getTableRowHtmlString(activity, checkedId) {
	const c0 = (checkedId == 0) ? "checked" : "";
	const c1 = (checkedId == 1) ? "checked" : "";
	const c2 = (checkedId == 2) ? "checked" : "";
	const c3 = (checkedId == 3) ? "checked" : "";
	const c4 = (checkedId == 4) ? "checked" : "";
	return `<tr class="question">
            <td class="tg-dvpl"><label class="value_act" for="activity">${activity}</label></td>
            <td class="tg-baqh"><input class="opt" type="radio" name="${activity}" value="0" ${c0}/></td>
            <td class="tg-baqh"><input class="opt" type="radio" name="${activity}" value="1" ${c1}/></td>
            <td class="tg-baqh"><input class="opt" type="radio" name="${activity}" value="2" ${c2}/></td>
            <td class="tg-baqh"><input class="opt" type="radio" name="${activity}" value="3" ${c3}/></td>
            <td class="tg-baqh"><input class="opt" type="radio" name="${activity}" value="4" ${c4}/></td>
        </tr>`
}

$(document).ready(function() {
	const st1 = $('#status1');
	const st2 = $('#status2');

	const table = $('#valueTable');

	$('#load').click(function() {
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

			const questions = Array.from(document.getElementsByClassName('question'));
			questions.forEach(question => {
				question.parentElement.removeChild(question);
			});

			Object.keys(values).forEach(activity => {
				const html = getTableRowHtmlString(activity, values[activity]);
				table.append(html);
			})
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
				if (!xhr || xhr.length === 0) {
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

	$('#save').click(function(e) {
		const data = $('#userValuesForm').serialize();
		const user = $('#user').val();
		st1.text("");
		st2.text("");
		$.ajax({
			type: 'POST',
			url: `api/v1/users/${user}`,
			data: data,
			success: function() {
				st1.text("User values successfully saved!")
			},
			error: function(xhr, status, error) {
				st1.text("Error! Your user values were not saved. Error message: " + (xhr.responseText || xhr.statusText))
			},
		});
	});
});

