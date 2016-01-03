$(document).ready(function() {
	$(".derailer").on("click", function() {
		$("#mineText").text($(this).data("text"));
		$("#centralCircle p").text($(this).data("title"))
	});
});