// prepare the form when the DOM is ready
$(document).ready(function() {
    localStorage.removeItem("token");
    var dest = $('a.goTo').attr('href');
    window.location.replace(dest);
});