var mongo = require('mongodb').MongoClient;
var traceback = require('traceback');


var loggit = function (message, sourcefile, methodName, LineNo) {
    //var tb = traceback()[1]; // 1 because 0 should be your enterLog-Function itself
    // fs.appendFile('errlog.txt', message + '\t' + tb.file + '\t' + tb.method + '\t' + tb.line + '\n', function (e) {
    //     if (e) {
    //         console.log('Error Logger Failed in Appending File! ' + e);
    //     }
    // });
    //console.log("DEBUG: " + message + ' | ' + tb.file + ' | ' + tb.method + ' | ' + tb.line + '.');
    console.log("  -- DEBUG: " + message);
};

module.exports = {

    
    //##: Renders a jade template if authorized or redirects if not
    renderTemplateOrRedirect: function (authorized, res, onSuccess, onFailure) {
        if (authorized) {
            res.render(onSuccess, {title: process.env.cgsbAppTitle, systemfqdn:process.env.cgsbSystemFQDN, username:"Dave Jones"});
        } else {
            res.redirect(onFailure);
        }
    },

    //##: Checks if a token is valid and if it is, fires the callback function
    sessionIsValid: function (token, req, res, callback) {
        var cbarg1 = arguments[4];
        var cbarg2 = arguments[5];

        console.log("sessionIsValid("+token+")");

        mongo.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                loggit("tokenIsValid(token): Error connecting to mongo: " + err);
                return false;
            }


            db.collection(process.env.cgsbCollectionTokens).find({"token": token}).toArray(function (err, records) {
                //##: Make sure we only got one record back. If not, then this
                //##: may be some type of dump and we should abort
                if (records.length === 1) {
                    console.log(" -- token check was valid for: [" + token + "]");
                    if (typeof callback === "function") {
                        console.log("Call -> callback(true, res, " + arguments[4] + ", " + arguments[5] + ")");
                        callback(true, res, cbarg1, cbarg2);
                    }
                    return true;
                } else {
                    console.log(" -- error: Got more than one record back during token check for: [" + token + "]");
                    if (typeof callback === "function") {
                        callback(false, res, cbarg1, cbarg2);
                    }
                    return false;
                }
            })
        });
    },

    //##: Checks if a token is valid and if it is, fires the callback function
    emailIsValid: function (email, token, res, callback) {
        mongo.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                loggit("emailIsValid(token): Error connecting to mongo: " + err);
                return false;
            }

            db.collection(process.env.cgsbCollectionUsers).find({
                "email": email,
                "registerToken": token
            }).toArray(function (err, records) {
                //##: Make sure we only got one record back. If not, then this
                //##: may be some type of dump and we should abort
                if (records.length === 1) {
                    loggit("Email: [" + email + "] verify token check was valid for: [" + token + "]");
                    if (typeof callback === "function") {
                        callback(true, res);
                    }
                    return true;
                } else {
                    loggit("Error: Got more than one record back during email: [" + email + "] verify token check for: [" + token + "]");
                    if (typeof callback === "function") {
                        callback(false, res);
                    }
                    return false;
                }
            })
        });
    },

    //##: Checks if a token is valid and if it is, fires the callback function
    tokenIsValid: function (token, req, res, callback) {
        console.log("tokenIsValid("+token+")");
        mongo.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                loggit("tokenIsValid(token): Error connecting to mongo: " + err);
                return false;
            }

            db.collection(process.env.cgsbCollectionTokens).find({"token": token}).toArray(function (err, records) {
                //##: Make sure we only got one record back. If not, then this
                //##: may be some type of dump and we should abort
                if (records.length === 1) {
                    loggit("TOKEN CHECK: [" + token + "] verified.");
                    if (typeof callback === "function") {
                        callback(true, req, res, records[0].userid);
                    }
                    return true;
                } else {
                    loggit("Error: Got more than one record back during token check for: [" + token + "]");
                    if (typeof callback === "function") {
                        callback(false, req, res, "");
                    }
                    return false;
                }
            })
        });
    },

    //##: Create a new session token and store it in the database for this user
    newSessionToken: function (userid, req, res) {
        var crypt = require('crypto');
        var MongoClient = require('mongodb').MongoClient;

        //##: Store hash in your password DB.
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            crypt.randomBytes(20, function (err, buffer) {
                var token = buffer.toString('hex');
                console.log("DEBUG(token): " + token);

                //##: Store the token in the token collection for this user
                var collectionTokens = db.collection(process.env.cgsbCollectionTokens);
                collectionTokens.remove({"userid": userid}, {w: 1}, function (err, result) {
                });
                collectionTokens.insert({"userid": userid, "token": token}, {w: 1}, function (err, result) {
                });

                //##: Return the token after successful login
                //##: Set it in a cookie
                res.setHeader('Content-Type', 'application/json');
                req.session.token = token;
                res.send(JSON.stringify({"status": true, "description": "New session created.", "token": token}));

                return token;
            });
        });
    },

    //##: Send an email to verify if the email address is valid
    sendEmailVerification: function (emailaddr, token) {
        var email = require("./node_modules/emailjs/email");
        var encodedemail = emailaddr;
        var server = email.server.connect({
            user: process.env.cgsbEmailUsername,
            password: process.env.cgsbEmailPassword,
            host: process.env.cgsbEmailServer,
            ssl: true
        });

        var emailbody = "http://"+process.env.cgsbSystemFQDN+"/verify?email=" + encodeURIComponent(encodedemail) + "&token=" + token;
        console.log("EMAILBODY: " + emailbody);

        //send the message and get a callback with an error or details of the message that was sent
        server.send({
            text: emailbody,
            from: 'You <'+process.env.cgsbEmailUsername+'>',
            //TODO: change this to the real email address
            to: "someone <"+process.env.cgsbEmailUsername+">",
            subject: "verify email"
        }, function (err, message) {
            console.log(err || message);
        });

        loggit("Sent email to: [" + emailaddr + "]");
    },

    addEpisodeToFeed: function (show, episode) {

    },

    //##: Create an RSS feed for a new show
    newShowFeed: function (show) {
        var RSS = require('rss');


    }

};