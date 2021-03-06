var express = require('express');
var router = express.Router();
var showBuilder = require('../showBuilder');

//##: Base landing page
//##: ---------------------------------------------------------------------------
//##: Returns a login form if there is no active user session with valid token or
//##: redirects to the /home page if there IS a valid token and session.
//##: ---------------------------------------------------------------------------


router.get('/', function (req, res, next) {
    console.log("INDEX request: GET /");
    if(req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'home', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

router.get('/cleanSession', function (req, res, next) {
    console.log("CLEAN Session: GET /cleanSession -> token: " + req.session.token);
    delete req.session.token;
    res.render('removeTokenAndRedirect', {title: process.env.cgsbAppTitle, desturl: '/login'});
});

router.get('/login', function (req, res, next) {
    console.log(req.session);
    if(req.session.token) {
        //TODO: !!! This register check needs a lot more validation tests
        res.redirect('/home');
    } else {
        res.render('index', {title: process.env.cgsbAppTitle});
    }
});

router.get('/register', function (req, res, next) {
    console.log(req.session);
    if(req.session.token) {
        //TODO: !!! This register check needs a lot more validation tests
        res.redirect('/home');
    } else {
        res.render('register', {title: process.env.cgsbAppTitle});
    }
});

router.get('/verify', function (req, res, next) {
    console.log(req.session);
    if(req.session.token) {
        //TODO: !!! This email verify check needs a lot more validation tests
        res.redirect('/home');
    } else {
        var email = req.query.email;
        var token = req.query.token;
        console.log("Verifying email: ["+email+"]");
        //Not already logged in with a valid token, so check email verify code
        showBuilder.emailIsValid(email, token, res, activateAccount);
        
        //res.render('verify', {title: process.env.cgsbAppTitle});
    }
});

router.get('/options', function (req, res, next) {
    console.log("OPTIONS request: GET /options");
    if(req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'options', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

router.get('/account', function (req, res, next) {
    console.log("ACCOUNT request: GET /account");
    if(req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'account', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

router.get('/services', function (req, res, next) {
    console.log("SERVICES request: GET /services");
    if(req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'services', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

router.get('/script', function (req, res, next) {
    console.log("SCRIPT request: GET /script");
    if (req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'script', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

router.get('/shownotes', function (req, res, next) {
    console.log("SHOWNOTES request: GET /shownotes");
    if (req.session.token) {
        //TODO: !!! This token check needs a lot more validation tests
        console.log("  -- found a token, now checking if it's valid.");
        showBuilder.sessionIsValid(req.session.token, req, res, showBuilder.renderTemplateOrRedirect, 'shownotes', '/cleanSession');
    } else {
        console.log("  -- no token found. Rendering index jade.");
        res.render('index', {title: process.env.cgsbAppTitle, systemfqdn: process.env.cgsbSystemFQDN});
    }
});

//##: Testing
router.post('/mediaFileUpload', function (req, res) {
    console.log("File upload request incoming...");
    console.log(req.files.mediafile.file);
    //##: Report success
    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.send(JSON.stringify({
        "status": true,
        "id": req.files.mediafile.uuid,
        "filename": req.files.mediafile.filename,
        "field": req.files.mediafile.field,
        "description": "File upload complete."
    }));
});

function activateAccount(emailIsValid, res) {
    if(emailIsValid) {
        res.redirect('/home');
    } else {
        res.render('errorVerify', {title: process.env.cgsbAppTitle, message: "This email did not verify."});
    }
}
 

module.exports = router;