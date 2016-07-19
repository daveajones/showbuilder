/**
 * Created by dave on 6/18/16.
 * Do things here that set up the client side environment for other scripts
 * like globals and such
 */

var showBuilder = showBuilder || {};
$(document).ready(function() {
    console.log("client-env.js");

    showBuilder.showAlert = function (msg, status) {
        var alertclasses = ["alert-success", "alert-info", "alert-warning", "alert-danger"];
        var elAlertBar = $('.alertbar');
        var elAlertWrapper = elAlertBar.find('div.alertwrapper');
        var elAlert = elAlertBar.find('div.alert');

        if(elAlert.length === 0) {
            //Create the alert element if not exist
            elAlertWrapper.append('<div class="alert hide" role="alert"></div>');
            elAlertWrapper.find('div.alert').append('<button class="close" type="button" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button><span class="msg">&nbsp;</span>');

        }

        console.log("showAlert()");

        elAlert.removeClass(alertclasses.join(" "));

        if(status) {
            elAlert.addClass("alert-success");
        } else {
            elAlert.addClass("alert-danger");
        }

        elAlertBar.find('span.msg').text(msg);
        elAlertBar.find('div.alert').removeClass('hide');

        return true;
    };

    showBuilder.apiGetAccountDetails = function () {
        var authToken = getAuthToken();
        var deferredObject = $.Deferred();
        //Ajax call
        $.ajax({
            method: "GET",
            url: "/api/v1/account",
            headers: {
                'X-AuthToken': authToken
            }
        })
            .done(function (responseData) {
                if (responseData.status) {
                    console.log("DEBUG: " + typeof responseData.status);
                    deferredObject.resolve(responseData.account);
                } else {
                    deferredObject.reject(responseData.description);
                }
            });
        //Return a promise
        return deferredObject.promise();
    };

    showBuilder.updateUIDetails = function () {
        showBuilder.apiGetAccountDetails()
            .done(function (account) {
                $('a#userNavMenu').find('span').html(account.firstname + " " + account.lastname);
            })
            .fail(function (description) {
                showBuilder.showAlert(description);
            });
    };

    showBuilder.updateUIDetails();

});