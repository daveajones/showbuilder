var express = require('express');
var router = express.Router();
var showBuilder = require('../showBuilder');

/* GET home page. */

router.get('/', function (req, res, next) {
    console.log("DEBUG: [/home/] Token: " + req.session.token);
    if(req.session.token) {
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'home', '/cleanSession');
    } else {
        res.redirect('/login');
    }
    //showBuilder.loggit("This is a logging test.");
});


module.exports = router;