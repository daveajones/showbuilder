/**
 * Created by dave on 6/18/16.
 */
function getAuthToken() {
    return localStorage.getItem("token");
}

function makeRequest(method, endpoint, data) {
    var authToken = getAuthToken();
    var deferredObject = $.Deferred();
    //Ajax call
    $.ajax({
        method: method,
        url: "/api/v1/" + endpoint,
        dataType: 'json',
        data: JSON.stringify(data),
        headers: {
            'X-AuthToken': authToken
        }
    })
        .done(function (responseData) {
            if (responseData.status) {
                deferredObject.resolve(responseData);
            } else {
                deferredObject.reject(responseData.description);
            }
        });
    //Return a promise
    return deferredObject.promise();
}