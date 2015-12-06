$(document).ready(function() {
	$(".derailer").on("click", function() {
		$("#mineText").text($(this).data("text"));
		$("#minecart h1").text($(this).data("type"));
		$("#centralCircle h1").text($(this).data("title"));
		
	});
});