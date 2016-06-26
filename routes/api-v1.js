var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var validator = require('validate-email');
var showBuilder = require('../showBuilder');


/***** User management *****/

/* Register a new user and start email validation */
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

/* Set a new password in the database for this user */
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

/* Check the email/password combination for validity and pass back a token if valid */
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

/* Check the email verification token against the db to see if this new account is valid */
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

/* Remove the session cookie and the session token */
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

/***** Account management *****/

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

/***** Show management *****/

/* Create a new show for the user specified by the token */
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

        //##: Need to have a show title and needs to be long enough with no
        //##: wierd characters
        if (!title || title.length < 1) {
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "Shows must have a title."}));
            return false;
        }

        //##: Need to have a valid show link either external or internal
        //TODO: this link checking needs more validation (starts with http?)
        if (!link || link.length < 1) {
            //TODO: Generate an internal link if one was not given
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({"status": false, "description": "That show link is not valid."}));
            return false;
        }

        //##: Connect to db and search for a show with this title already
        var ObjectId = require('mongodb').ObjectID;
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
                "title": title,
                "userid": objectUserId
            }).toArray(function (err, records) {

                //##: If a record already existed for this show/user combo give back an error
                if (records.length !== 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(422);
                    res.send(JSON.stringify({"status": false, "description": "That show title already exists."}));
                    return false;
                }

                //##: Insert this show
                var objectToInsert = {
                    "userid": userid,
                    "title": title,
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

/* Retrieve the details about a show for the user of this token */
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
        var ObjectId = require('mongodb').ObjectID;
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

/* Retrieve a list of all the shows for this user */
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
        var ObjectId = require('mongodb').ObjectID;
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


/***** Episode management *****/

/* Create a new episode or update one for a show for the user specified by the token */
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
        var published = false;
        if(req.body.published) {
            published = true;
        }
        var albumart = req.body.albumart;
        var mediafile = req.body.mediafile;
        var showid = req.params.showid;
        var dateNow = new Date().toISOString();


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
        if (!link || link.length < 1 || link.indexOf('http') < 0) {
            //TODO: if no external link was given we need to create an internal one
            res.setHeader('Content-Type', 'application/json');
            res.status(422);
            res.send(JSON.stringify({
                "status": false,
                "description": "That show link is not valid."
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

        //##: Connect to db and search for a show with this title already
        var ObjectId = require('mongodb').ObjectID;
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
                        "number": number,
                        "description": description,
                        "dateModified": dateNow,
                        "published": published,
                        "albumart": albumart,
                        "mediafile": mediafile,
                        "showid": showObjectId
                    };
                    collectionEpisodes.update({
                        "showid": showObjectId,
                        "number": number,
                        "userid": userObjectId
                    }, objectToInsert, {w: 1}, function (e, result) {
                        var objectId = objectToInsert._id;

                        //##: DEBUG
                        console.log("DEBUG(database) UPDATE EPISODE: [" + number + " | " + title + "]");

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
                        "number": number,
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
                        console.log("DEBUG(database) NEW EPISODE: [" + number + " | " + title + "]");

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

/* Retrieve the details about an episode of a certain show */
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
        var ObjectId = require('mongodb').ObjectID;
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

/* Retrieve a list of all the episodes for this show */
router.get('/episodes/:showid', function (req, res, next) {
    console.log("HEADER: " + req.get("X-AuthToken"));
    showBuilder.tokenIsValid(req.get("X-AuthToken"), req, res, function (tvalid, req, res, userid) {
        if (!tvalid) {
            res.setHeader('Content-Type', 'application/json');
            res.status(401);
            res.send(JSON.stringify({"status": false, "description": "Token is not valid."}));
            return false;
        }

        var showid = req.params.showid;
        console.log("SHOWID " + showid);

        //##: Connect to db and search for all episodes with this shortname
        var ObjectId = require('mongodb').ObjectID;
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
            collectionEpisodes.find({"userid": userid, "showid": showObjectId}).sort({number: -1}).toArray(function (err, records) {

                //##: If no episodes exist for this show id then bail
                if (records.length === 0) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(422);
                    res.send(JSON.stringify({"status": false, "description": "No episodes exist for this show."}));
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


module.exports = router;