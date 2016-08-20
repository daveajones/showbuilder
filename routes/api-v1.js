var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var validator = require('validate-email');
var showBuilder = require('../showBuilder');
var ObjectId = require('mongodb').ObjectID;


//##: ---------- User ----------------------

//##: Register a new user and start email validation
router.post('/register', function (req, res, next) {
    var email = req.body.email;
    var password = req.body.password;

    //##: Start clean
    delete req.session.token;

    //##: Check email for validity
    if (!validator(email)) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({"status": false, "description": "[" + email + "] is not a valid email address."}));
        return false;
    }

    //##: Connect to db and search for a user with this email address
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
        if (err) {
            res.render('error', {
                message: err.message,
                error: err
            });
        }

        //##: Find user
        var collectionUsers = db.collection(process.env.cgsbCollectionUsers);
        collectionUsers.find({"email": email}).toArray(function (err, records) {

            //##: If a record already existed for this email address hand back an error
            if (records.length !== 0) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({"status": false, "description": "That email address is already registered."}));
                return false;
            }


            //##: Hash the password first before checking it
            bcrypt.genSalt(10, function (err, salt) {
                bcrypt.hash(password, salt, function (err, hash) {
                    bcrypt.hash(hash, salt, function (err, token) {

                        console.log(process.env.cgsbDatabaseName + " | " + hash + " | " + salt + " | " + token);

                        regtoken = token.replace(/\W/g, '').substring(0, 20);

                        // Store hash as a registration token

                        //##: Insert this user if not exists
                        var collectionUsers = db.collection(process.env.cgsbCollectionUsers);
                        //collectionUsers.insert({"email": email, "password": hash}, {w: 1}, function (err, result) {});
                        collectionUsers.update({"email": email}, {
                            "email": email,
                            "password": hash,
                            "registerToken": regtoken
                        }, {upsert: true});

                        //##: Send email to verify
                        showBuilder.sendEmailVerification(email, regtoken);

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({
                            "status": true,
                            "token": regtoken,
                            "description": "Success! Check your email for the verification link."
                        }));
                        return false;
                    });
                });
            });


            //##: DEBUG
            console.log("DEBUG(database) REGISTER SUBMISSION: [" + email + "]");
        });
    });
});

//##: Set a new password in the database for this user
router.post('/setPassword', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }
        var email = req.body.email;
        var password = req.body.password;

        //##: Check email for validity
        if (!validator(email)) {
            res.render('errorLogin', {message: "The email: [" + email + "] is not valid."});
            return false;
        }

        //##: Check cookie or api param for valid auth token


        //##: Hash the password first before checking it
        bcrypt.genSalt(10, function (err, salt) {
            bcrypt.hash(password, salt, function (err, hash) {

                console.log(process.env.cgsbDatabaseName + " | " + hash + " | " + salt);

                // Store hash in your password DB.
                // Retrieve
                var MongoClient = require('mongodb').MongoClient;
                MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
                    if (err) {
                        return console.dir(err)
                    }

                    //##: Insert this user if not exists
                    var collectionUsers = db.collection(process.env.cgsbCollectionUsers);
                    //collectionUsers.insert({"email": email, "password": hash}, {w: 1}, function (err, result) {});
                    collectionUsers.update({"email": email}, {"email": email, "password": hash}, {upsert: true});

                    //##: Report success
                    res.send('Set email: [' + email + '] and password: [' + password + '] for user: [' + userid + '].');
                });
            });
        });
    });
});

//##: Check the email/password combination for validity and pass back a token if valid
router.post('/login', function (req, res, next) {
    var email = req.body.email;
    var password = req.body.password;

    //##: Store hash in your password DB.
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
        if (err) {
            res.render('error', {
                message: err.message,
                error: err
            });
        }

        //##: Find user
        var collectionUsers = db.collection(process.env.cgsbCollectionUsers);
        collectionUsers.find({"email": email}).toArray(function (err, records) {

            //##: Make sure we only got one record back. If not, then this
            //##: may be some type of dump and we should abort
            if (records.length !== 1) {
                res.setHeader('Content-Type', 'application/json');
                delete req.session.token;
                res.status(422);
                res.send(JSON.stringify({"status": false, "description": "Those credentials are not valid."}));
                return false;
            }

            //##: DEBUG
            console.log("DEBUG(database): " + records[0].email + "|" + records[0].password);

            //##: Now hash the password and compare to what was returned
            bcrypt.compare(password, records[0].password, function (err, bcresults) {
                if (bcresults === false || err) {
                    //res.render('errorLogin', {message: "Those credentials: [" + email + " | "+records[0].password+"] are not valid."});
                    res.setHeader('Content-Type', 'application/json');
                    delete req.session.token;
                    res.status(422);
                    res.send(JSON.stringify({"status": false, "description": "Those credentials are not valid."}));
                    return false;
                }
                console.log('Login success for: [' + email + '] and password: [' + password + '] for user: [user].');
                console.log('DEBUG(userid): ' + records[0]._id);

                //##: Generate a token for this new login
                showBuilder.newSessionToken(records[0]._id, req, res);
            });
        });
    });
});

//##: Check the email verification token against the db to see if this new account is valid
router.post('/verify', function (req, res, next) {
    var email = req.body.email;
    var token = req.body.token;

    //##: Start clean
    delete req.session.token;

    //##: Store hash in your password DB.
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
        if (err) {
            res.render('error', {
                message: err.message,
                error: err
            });
        }

        //##: Find user
        var collectionUsers = db.collection(process.env.cgsbCollectionUsers);
        collectionUsers.find({"email": email, "registerToken": token}).toArray(function (err, records) {

            //##: Make sure we only got one record back. If not, then this
            //##: may be some type of dump and we should abort
            if (records.length !== 1) {
                res.setHeader('Content-Type', 'application/json');
                res.status(422);
                res.send(JSON.stringify({"status": false, "description": "Verification data is not valid."}));
                return false;
            }

            //##: DEBUG
            console.log("DEBUG(database): " + records[0].email + "|" + records[0].password);

            console.log('Verification success for: [' + email + '] and token: [' + token + '].');
            console.log('--> DEBUG(userid): ' + records[0]._id);

            //##: Report success
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({"status": true, "description": "Account email verified."}));
            return true;
        });
    });
});

//##: Remove the session cookie and the session token
router.post('/logout', function (req, res, next) {
    var token = req.body.token;

    //##: Remove token from the database
    var MongoClient = require('mongodb').MongoClient;
    MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
        if (err) {
            res.render('error', {
                message: err.message,
                error: err
            });
        }

        //##: Remove this token from the token collection
        db.collection(process.env.cgsbCollectionTokens)
            .remove({"token": token}, {w: 1}, function (err, result) {
            });

        console.log('Session logged out: ' + token);

        //##: Redirect to the index page
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({"status": true, "description": "Token [" + token + "] is now invalidated."}));
    });

    //##:: Delete the session value
    delete req.session.token;
});


//##: ---------- Account

//##: Set the account options for a user
//TODO: Need LOTS of defense here for these user supplied values
router.post('/account', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }
        var firstname = req.body.firstname;
        var lastname = req.body.lastname;
        var personalsite = req.body.personalsite;

        //##: Check url for validity
        //TODO: validate inputs here. very important!

        //Update the account options in the database
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                return console.dir(err)
            }

            var objectToInsert = {
                "userid": userid,
                "firstname": firstname,
                "lastname": lastname,
                "personalsite": personalsite
            };
            var collectionAccounts = db.collection(process.env.cgsbCollectionAccounts);
            //collectionUsers.insert({"email": email, "password": hash}, {w: 1}, function (err, result) {});
            collectionAccounts.update(
                {"userid": userid},
                objectToInsert,
                {upsert: true},
            {w:1}, function(e, result) {
                if (e) {
                    //##: Report error
                    //TODO: this should be a standard error response handler and not copy/pasted a million times
                    res.setHeader('Content-Type', 'application/json');
                    res.status(500);
                    res.send(JSON.stringify({
                        "status": false,
                        "result": result,
                        "description": "There was an error processing this request."
                    }));
                    return false;
                }

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "episodes": records,
                    "count": records.length,
                    "description": "[" + records.length + "] episodes found."
                }));
            });
        });
    });
});

//##: Get the account options for a user
router.get('/account', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/showid
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find a user with the given id
            var collectionAccounts = db.collection(process.env.cgsbCollectionAccounts);
            var objectUserId = new ObjectId(userid);
            collectionAccounts.find({
                "userid": objectUserId
            }).toArray(function (err, records) {
                if(err) {
                    //##: Error occured
                        res.setHeader('Content-Type', 'application/json');
                        res.status(500);
                        res.send(JSON.stringify({
                            "status": false,
                            "userid": userid,
                            "description": "An error occured looking for account details."
                        }));
                        return false;
                }

                //##: If a record does not exist give back an error
                if (records.length !== 1) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No account details exist for user id: [" + userid + "]."
                    }));
                    return false;
                }

                console.log("DEBUG(database) Found User id: [" + records[0].userid.toString() + " | "+userid+"]");

                //##: DEBUG
                if (records[0].userid.toString() == userid) {
                    //##: Report success
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "userid": records[0].userid,
                        "account": records[0],
                        "description": "User account details found."
                    }));
                    return false;
                } else {
                    console.log("DEBUG(database) User id type mismatch [" + typeof records[0].userid + " | " + typeof userid + "]");
                    console.log(records[0]._id);

                    //##: Report failure
                    res.setHeader('Content-Type', 'application/json');
                    res.status(401);
                    res.send(JSON.stringify({
                        "status": false,
                        "userid": userid,
                        "description": "Error retreiving user account details: [" + records[0].userid + " | " + userid + "]"
                    }));
                    return false;
                }
            });
        });
    });
});


//##: ---------- Shows

//##: Create a new show for the user specified by the token
router.post('/show', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var title = req.body.title;
        var link = req.body.link;
        var shortname = req.body.shortname;

        //##: Need to have a show title and needs to be long enough with no
        //##: wierd characters
        if (!title || title.length < 3) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Shows must have a valid title."}));
            return false;
        }

        //##: Need to have a shortname and needs to be long enough with no
        //##: wierd characters
        if (!shortname || shortname.length < 3) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Shows must have a valid 'shortname'."}));
            return false;
        }

        //##: Need to have a valid show link either external or internal
        //TODO: this link checking needs more validation (starts with http?)
        if (link.length > 1 && link.indexOf('http') != 0) {
            //TODO: Generate an internal link if one was not given
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That show link is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title already
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find user
            var collectionShows = db.collection(process.env.cgsbCollectionShows);
            var objectUserId = new ObjectId(userid);
            collectionShows.find({
                "shortname": shortname,
                "userid": objectUserId
            }).toArray(function (err, records) {

                //##: If a record already existed for this show/user combo give back an error
                if (records.length !== 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(422);
                    res.send(JSON.stringify({"status": false, "description": "That show shortname already exists."}));
                    return false;
                }

                //##: Insert this show
                var objectToInsert = {
                    "userid": userid,
                    "title": title,
                    "shortname": shortname,
                    "link": link
                };
                collectionShows.insert(objectToInsert, {w: 1}, function (e, result) {
                    var objectId = objectToInsert._id;

                    //##: DEBUG
                    console.log("DEBUG(database) NEW SHOW: [" + title + "]");

                    //##: Report success
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "id": objectId,
                        "_id": objectId,
                        "userid": objectUserId,
                        "shortname": shortname,
                        "title": title,
                        "link": link,
                        "description": "New show created."
                    }));
                    return false;
                });
            });
        });
    });
});

//##: Retrieve the details about a show for the user of this token
router.get('/show/:showid', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;

        //##: Need to have a show show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/showid
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find a show with the given user id and show id
            var collectionShows = db.collection(process.env.cgsbCollectionShows);
            var objectShowId = new ObjectId(showid);
            var objectUserId = new ObjectId(userid);
            collectionShows.find({
                "_id": objectShowId,
                "userid": objectUserId
            }).toArray(function (err, records) {

                //##: If a record already existed for this show title give back an error
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No show exists with id: [" + showid + "]."
                    }));
                    return false;
                }

                //##: DEBUG
                if (records[0]._id.toString() === showid) {
                    console.log("DEBUG(database) Found Show id: [" + records[0]._id + "]");

                    //##: Report success
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "show": records[0],
                        "description": "Show found."
                    }));
                    return false;
                } else {
                    console.log("DEBUG(database) Show id type mismatch [" + typeof records[0]._id + " | " + typeof showid + "]");
                    console.log(records[0]._id);

                    //##: Report failure
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": false,
                        "show": showid,
                        "description": "Error retreiving show: [" + records[0]._id + " | " + showid + "]"
                    }));
                    return false;
                }
            });
        });
    });
});

//##: Delete a show for the user of this token
router.delete('/show/:showid', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;

        //##: Need to have a show show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/showid
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find a show with the given user id and show id
            var collectionShows = db.collection(process.env.cgsbCollectionShows);
            var objectShowId = new ObjectId(showid);
            var objectUserId = new ObjectId(userid);
            collectionShows.find({
                "_id": objectShowId,
                "userid": objectUserId
            }).toArray(function (err, records) {

                //##: If no show is found, give back an error
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No show exists with id: [" + showid + "]."
                    }));
                    return false;
                }

                //##: Delete the show
                if (records[0]._id.toString() === showid) {
                    console.log("DEBUG(database) Found Show id: [" + records[0]._id + "]");

                    collectionShows.deleteMany({
                        "_id": objectShowId,
                        "userid": objectUserId
                    }, {w: 1}, function (err, results) {
                        if (err) {
                            console.log("DEBUG(database) Show id type mismatch [" + typeof records[0]._id + " | " + typeof showid + "]");
                            console.log(records[0]._id);

                            //##: Report failure
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200);
                            res.send(JSON.stringify({
                                "status": false,
                                "showid": showid,
                                "description": "Error deleting show: [" + records[0]._id + " | " + showid + "]"
                            }));
                            return false;
                        } else {
                            //##: Report success
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200);
                            res.send(JSON.stringify({
                                "status": true,
                                "id": showid,
                                "show": records[0],
                                "description": "Show removed."
                            }));
                            return false;
                        }
                    });
                }
            });
        });
    });
});

//##: Retrieve a list of all the shows for this user
router.get('/shows', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find user
            var collectionShows = db.collection(process.env.cgsbCollectionShows);
            var objectUserId = new ObjectId(userid);
            collectionShows.find({"userid": objectUserId}).toArray(function (err, records) {

                //##: If a record already existed for this show title give back an error
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No shows exist for user: [" + userid + "]."
                    }));
                    return false;
                }

                //##: DEBUG
                records.forEach(function (cv, i, a) {
                    console.log("DEBUG(database) Found Show: [" + cv.title + "] for user: [" + userid + "]");
                });

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "shows": records,
                    "count": records.length,
                    "description": "[" + records.length + "] shows found."
                }));
                return false;
            });
        });
    });
});


//##: ---------- Shortnames

//##: Create a new shortname for a show
router.post('/shortname/:shortname', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var shortname = req.params.shortname;
        var showid = req.body.showid;

        //##: Need to have a shortname of a sane length
        if (!shortname || shortname.length < 1) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid shortname."}));
            return false;
        }

        //##: Need to have a show id of a sane length
        if (!showid || showid.length < 1) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Connect to db and search for a show with this title already
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find
            var collectionShortnames = db.collection(process.env.cgsbCollectionShortnames);
            var objectUserId = new ObjectId(userid);
            var objectShowId = new ObjectId(showid);
            collectionShortnames.find({
                "shortname": shortname
            }).toArray(function (err, records) {

                //##: If a record already existed for this show/user combo give back an error
                if (records.length !== 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(422);
                    res.send(JSON.stringify({"status": false, "description": "That shortname already exists."}));
                    return false;
                }

                //##: Insert this show
                var objectToInsert = {
                    "userid": objectUserId,
                    "showid": objectShowId,
                    "shortname": shortname
                };
                collectionShortnames.insert(objectToInsert, {w: 1}, function (e, result) {
                    var objectId = objectToInsert._id;

                    //##: DEBUG
                    console.log("DEBUG(database) NEW SHORTNAME: [" + shortname + "]");

                    //##: Report success
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "id": objectId,
                        "_id": objectId,
                        "userid": objectUserId,
                        "showid": objectShowId,
                        "shortname": shortname,
                        "description": "Shortname linked to show."
                    }));
                    return false;
                });
            });
        });
    });
});

//##: Check if a shortname for a show exists
router.head('/shortname/:shortname', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var shortname = req.params.shortname;

        //##: Need to have a show show id for lookup
        if (!shortname || shortname === "") {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid request."}));
            return false;
        }

        //##: Connect to db and search for this shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find a show with this shortname
            var collectionShortnames = db.collection(process.env.cgsbCollectionShortnames);
            var objectUserId = new ObjectId(userid);
            collectionShortnames.find({
                "shortname": shortname
            }).toArray(function (err, records) {

                //##: Check exists
                if (records.length !== 1) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No show exists with this shortname: [" + shortname + "]."
                    }));
                    return false;
                }

                //##: DEBUG
                if (records[0].shortname.toString() === shortname) {
                    console.log("DEBUG(database) Shortname found: [" + records[0].shortname.toString() + "]");

                    //##: Report success
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "description": "Shortname found."
                    }));
                    return false;
                } else {
                    console.log("DEBUG(database) Shortname type mismatch [" + typeof records[0].shortname + " | " + typeof shortname + "]");
                    console.log(records[0].shortname);

                    //##: Report failure
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": false,
                        "description": "Error retrieving shortname: [" + shortname + "]"
                    }));
                    return false;
                }
            });
        });
    });
});


//##: ---------- Episodes

//##: Create a new episode or update one for a show for the user specified by the token
router.put('/episode/:showid/:number', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //TODO: these user submitted values need a lot of checking for safety
        var title = req.body.title;
        var link = req.body.link;
        var number = req.params.number;
        var description = req.body.description;
        var published = (req.body.published === "true");
        var albumart = req.body.albumart;
        var mediafile = req.body.mediafile;
        console.log("MEDIAFILE: [![" + req.body.mediafile + "]!]");
        var showid = req.params.showid;
        var dateNow = new Date().toISOString();

        //##: Debug
        console.log('--------------------------------------');
        console.log(mediafile);
        console.log('--------------------------------------');


        //##: Need to have an episode title and needs to be long enough with no
        //##: wierd characters
        if (!title || title.length < 1) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({
                "status": false,
                "description": "Episodes must have a title."
            }));
            return false;
        }

        //##: Need to have a valid episode link either external or internal
        //TODO: this link checking needs more validation like ensuring http: at the beginning
        if (link.length > 1 && link.indexOf('http') != 0) {
            //TODO: if no external link was given we need to create an internal one
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({
                "status": false,
                "description": "That episode link is not valid."
            }));
            return false;
        }

        //##: Need to have a valid episode number
        if (!number || isNaN(number)) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Need to have a valid description
        if (!description || typeof description !== "string") {
            //set a blank description if none was given
            description = "";
        }

        //##: Need to have a valid shortname
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That shortname is not valid."}));
            return false;
        }

        //##: See if we have album art
        if (albumart != "") {
            var base64Data = albumart.replace(/^data:image\/png;base64,/, "");
            //console.log("BASE64 Image: " + base64Data);
            //TODO: Handle file here
            // require("fs").writeFile("/tmp/out.png", base64Data, 'base64', function (err) {
            //     console.log(err);
            // });
        }

        //##: Connect to db and search for a show with this title already
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionEpisodes = db.collection(process.env.cgsbCollectionEpisodes);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionEpisodes.find({
                "showid": showObjectId,
                "number": number,
                "userid": userObjectId
            }).toArray(function (err, records) {

                //##: If a record already existed this should be an update
                if (records.length !== 0) {
                    //##: Update this show
                    var objectToInsert = {
                        "userid": userObjectId,
                        "title": title,
                        "link": link,
                        "number": Number(number),
                        "description": description,
                        "dateModified": dateNow,
                        "published": published,
                        "albumart": albumart,
                        "mediafile": mediafile,
                        "showid": showObjectId
                    };
                    collectionEpisodes.update({
                        "showid": showObjectId,
                        "number": Number(number),
                        "userid": userObjectId
                    }, objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("UPDATE EPISODE: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "Episode updated."}));
                        return false;
                    });
                } else {
                    //##: Insert this show
                    var objectToInsert = {
                        "userid": userid,
                        "title": title,
                        "link": link,
                        "number": Number(number),
                        "description": description,
                        "dateModified": dateNow,
                        "published": published,
                        "albumart": albumart,
                        "mediafile": mediafile,
                        "showid": showObjectId
                    };
                    collectionEpisodes.insert(objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("INSERT EPISODE: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "New episode created."}));
                        return false;
                    });
                }
            });
        });
    });
});

//##: Retrieve the details about an episode of a certain show
router.get('/episode/:showid/:number', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;
        var number = req.params.number;

        console.log("Request for episode: " + number + " of show: " + showid + " for user: " + userid);

        //##: Need to have a show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Need to have an episode number too
        //TODO: this link checking needs more validation
        if (!number) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionEpisodes = db.collection(process.env.cgsbCollectionEpisodes);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionEpisodes.find({
                "showid": showObjectId,
                "userid": userObjectId,
                "number": number
            }).toArray(function (err, records) {

                //##: If a record already existed for this show title give back an error
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "description": "No episodes exist with those parameters."
                    }));
                    return false;
                }

                //##: DEBUG
                console.log("DEBUG(database) Found Show: [" + records[0].title + "]");

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "show": records[0],
                    "description": "Show found."
                }));
                return false;
            });
        });
    });
});

//##: Retrieve a list of all the episodes for this show
router.get('/episodes/:showid', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //Must have a showid
        if (!req.params.showid) {
            console.log("ERROR: Invalid show id.");
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        var showid = req.params.showid;
        console.log("SHOWID " + showid);

        //##: Connect to db and search for all episodes with this shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find user
            var collectionEpisodes = db.collection(process.env.cgsbCollectionEpisodes);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionEpisodes.find({
                "userid": userObjectId,
                "showid": showObjectId
            }).sort({number: -1}).toArray(function (err, records) {

                //##: If no episodes exist for this show id then bail
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200);
                    res.send(JSON.stringify({
                        "status": true,
                        "episodes": [],
                        "count": 0,
                        "description": "No episodes exist for this show."
                    }));
                    return false;
                }

                //##: DEBUG
                records.forEach(function (cv, i, a) {
                    console.log("DEBUG(database) Found episode: [" + cv.title + "] for show: [" + showid + "]");
                });

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "episodes": records,
                    "count": records.length,
                    "description": "[" + records.length + "] episodes found."
                }));
                return false;
            });
        });
    });
});

//##: Delete an episode for the user of this token
router.delete('/episode/:showid/:number', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;
        var number = req.params.number;

        //##: Need to have a show show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Need to have an episode number for lookup
        if (!number) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid episode number."}));
            return false;
        }

        //##: Connect to db and search for a show id and episode number
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find a show with the given user id and show id and episode number
            var collectionEpisodes = db.collection(process.env.cgsbCollectionEpisodes);
            var objectShowId = new ObjectId(showid);
            var objectUserId = new ObjectId(userid);
            objectToDelete = {
                "showid": objectShowId,
                "userid": objectUserId,
                "number": Number(number),
                "published": false
            };
            console.log("DELETE EPISODE: " + JSON.stringify(objectToDelete, null, 3));
            collectionEpisodes.find(objectToDelete).toArray(function (err, records) {

                //##: If no episode is found, give back an error
                if (records.length === 0) {
                    console.log("Couldn't find episode in database to delete.");
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "No episode exists with number: [" + number + "]."
                    }));
                    return false;
                }

                console.log("Found episode to delete: " + records.length);

                //##: Delete the episode
                if (records.length === 1) {
                    console.log("DEBUG(database) Found episode to delete: [" + records[0]._id + "]");

                    collectionEpisodes.deleteMany(objectToDelete, {w: 1}, function (err, results) {
                        if (err) {
                            console.log("DELETE EPISODE: " + JSON.stringify(objectToDelete, null, 3));

                            //##: Report failure
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200);
                            res.send(JSON.stringify({
                                "status": false,
                                "showid": showid,
                                "number": number,
                                "description": "Error deleting episode number: [" + number + " | " + showid + "]"
                            }));
                            return false;
                        } else {
                            //##: Report success
                            res.setHeader('Content-Type', 'application/json');
                            res.status(200);
                            res.send(JSON.stringify({
                                "status": true,
                                "id": showid,
                                "number": number,
                                "episode": records[0],
                                "description": "Episode removed."
                            }));
                            return false;
                        }
                    });
                } else {
                    console.log("Too many records were returned trying to delete.");

                    res.setHeader('Content-Type', 'application/json');
                    res.status(422);
                    res.send(JSON.stringify({
                        "status": false,
                        "count": 0,
                        "description": "Too many episodes returned for number: [" + number + "]."
                    }));
                    return false;
                }
            });
        });
    });
});


//##: ---------- Shownotes

//##: Create or update shownotes for an episode
router.put('/shownotes/:showid/:number', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //TODO: these user submitted values need a lot of checking for safety
        var number = req.params.number;
        var showid = req.params.showid;
        var opml = req.body.opml;
        var dateNow = new Date().toISOString();

        //##: Need to have a valid episode number
        if (!number || isNaN(number)) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Need to have a valid opml structure
        if (!opml || typeof opml !== "string") {
            //set a blank opml if none was given
            opml = "";
        }

        //##: Need to have a valid shortname
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That shortname is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title already
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionShownotes = db.collection(process.env.cgsbCollectionShownotes);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionShownotes.find({
                "showid": showObjectId,
                "number": Number(number),
                "userid": userObjectId
            }).toArray(function (err, records) {

                //##: If a record already existed this should be an update
                if (records.length > 0) {
                    //##: Update this show
                    var objectToInsert = {
                        "userid": userObjectId,
                        "number": Number(number),
                        "opml": opml,
                        "dateModified": dateNow,
                        "showid": showObjectId
                    };
                    collectionShownotes.update({
                        "showid": showObjectId,
                        "number": Number(number),
                        "userid": userObjectId
                    }, objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("UPDATE SHOWNOTES: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "Shownotes updated."}));
                        return false;
                    });
                } else {
                    //##: Insert this show
                    var objectToInsert = {
                        "userid": userid,
                        "number": Number(number),
                        "opml": opml,
                        "dateModified": dateNow,
                        "showid": showObjectId
                    };
                    collectionShownotes.insert(objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("INSERT SHOWNOTES: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "Shownotes created."}));
                        return false;
                    });
                }
            });
        });
    });
});

//##: Retrieve the shownotes for an episode of a certain show
router.get('/shownotes/:showid/:number', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;
        var number = req.params.number;

        console.log("Request for shownotes of episode: " + number + " of show: " + showid + " for user: " + userid);

        //##: Need to have a show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Need to have an episode number too
        //TODO: this link checking needs more validation
        if (!number) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionShownotes = db.collection(process.env.cgsbCollectionShownotes);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionShownotes.find({
                "showid": showObjectId,
                "userid": userObjectId,
                "number": Number(number)
            }).toArray(function (err, records) {

                //##: If no record already existed for this show title give back an error
                if (records.length == 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "description": "No shownotes exist with those parameters."
                    }));
                    return false;
                }

                //##: DEBUG
                console.log("DEBUG(database) Found shownotes: [" + records[0].opml + "]");

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "opml": records[0].opml,
                    "description": "Shownotes found."
                }));
                return false;
            });
        });
    });
});


//##: ---------- Scripts

//##: Create or update script for an episode
router.put('/script/:showid/:number', function (req, res, next) {
    console.log("HEADERS: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        //TODO: these user submitted values need a lot of checking for safety
        var number = req.params.number;
        var showid = req.params.showid;
        var opml = req.body.opml;
        var dateNow = new Date().toISOString();

        //##: Need to have a valid episode number
        if (!number || isNaN(number)) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Need to have a valid opml structure
        if (!opml || typeof opml !== "string") {
            //set a blank opml if none was given
            opml = "";
        }

        //##: Need to have a valid shortname
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That shortname is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title already
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionScript = db.collection(process.env.cgsbCollectionScripts);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionScript.find({
                "showid": showObjectId,
                "number": Number(number),
                "userid": userObjectId
            }).toArray(function (err, records) {

                //##: If a record already existed this should be an update
                if (records.length > 0) {
                    //##: Update this show
                    var objectToInsert = {
                        "userid": userObjectId,
                        "number": Number(number),
                        "opml": opml,
                        "dateModified": dateNow,
                        "showid": showObjectId
                    };
                    collectionScript.update({
                        "showid": showObjectId,
                        "number": Number(number),
                        "userid": userObjectId
                    }, objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("UPDATE SHOWNOTES: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "Script updated."}));
                        return false;
                    });
                } else {
                    //##: Insert this show
                    var objectToInsert = {
                        "userid": userid,
                        "number": Number(number),
                        "opml": opml,
                        "dateModified": dateNow,
                        "showid": showObjectId
                    };
                    collectionScript.insert(objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("INSERT SHOWNOTES: " + JSON.stringify(objectToInsert, null, 3));

                        //##: Report success
                        res.setHeader('Content-Type', 'application/json');
                        res.status(200);
                        res.send(JSON.stringify({"status": true, "id": objectId, "description": "Script created."}));
                        return false;
                    });
                }
            });
        });
    });
});

//##: Retrieve the script for an episode of a certain show
router.get('/script/:showid/:number', function (req, res, next) {
    showBuilder.s3CreateBucket();

    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;
        var number = req.params.number;

        console.log("Request for script of episode: " + number + " of show: " + showid + " for user: " + userid);

        //##: Need to have a show id for lookup
        if (!showid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Invalid show id."}));
            return false;
        }

        //##: Need to have an episode number too
        //TODO: this link checking needs more validation
        if (!number) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That episode number is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title/shortname
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect("mongodb://" + process.env.cgsbDatabaseHost + ":" + process.env.cgsbDatabasePort + "/" + process.env.cgsbDatabaseName, function (err, db) {
            if (err) {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }

            //##: Find episode
            var collectionScript = db.collection(process.env.cgsbCollectionScripts);
            var showObjectId = new ObjectId(showid);
            var userObjectId = new ObjectId(userid);
            collectionScript.find({
                "showid": showObjectId,
                "userid": userObjectId,
                "number": Number(number)
            }).toArray(function (err, records) {

                //##: If no record already existed for this show title give back an error
                if (records.length == 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(404);
                    res.send(JSON.stringify({
                        "status": false,
                        "description": "No script exist with those parameters."
                    }));
                    return false;
                }

                //##: DEBUG
                console.log("DEBUG(database) Found script: [" + records[0].opml + "]");

                //##: Report success
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                res.send(JSON.stringify({
                    "status": true,
                    "opml": records[0].opml,
                    "description": "Script found."
                }));
                return false;
            });
        });
    });
});


module.exports = router;