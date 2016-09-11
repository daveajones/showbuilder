var mongo = require('mongodb').MongoClient;
var traceback = require('traceback');
var AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.cgsbAWSBucketKey,
    secretAccessKey: process.env.cgsbAWSBucketSecret,
    region: "us-east-1"
});


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
            //var accountDetails = showBuilder.getAccountDetails
            res.render(onSuccess, {
                title: process.env.cgsbAppTitle,
                systemfqdn: process.env.cgsbSystemFQDN,
                username: ""
            });
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

        var emailbody = process.env.cgsbSystemFQDN+"/verify?email=" + encodeURIComponent(encodedemail) + "&token=" + token;
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

    //##: Get/Set the media storage provider for a user
    setMediaStorageProvider: function (userId, provider) {
        //TODO: save the combo in the userStorage collection
    },
    getMediaStorageProvider: function (userId) {
        return "aws-s3";
    },

    //##: Get/Set the credentials for a provider/user combination. For some services the tokens
    //##: might represent username (token1) and password (token2). For others, like AWS, the tokens
    //##: might be access keys (ID and secret). Yet others, like SCP, may have an SSH key for token1
    setMediaStorageProviderCredentials: function (userId, provider, token1, token2) {

    },
    getMediaStorageProviderCredentials: function (userId, provider) {
        return {
            "username": process.env.cgsbAWSBucketKey,
            "password": process.env.cgsbAWSBucketSecret
        }
    },

    //##: Get/Set the storage path for a provider/user combo.  In AWS-S3 the path would be a bucket+key
    //##: string to prefix. In SCP this would be a full path from the root of the remote drive
    setMediaStorageProviderPath: function (userId, provider) {

    },
    getMediaStorageProviderPath: function (userId, provider, shortname) {
        return shortname + '.' + process.env.cgsbAWSBucketDomain;
    },

    //##: AWS S3 -----------------------------
    //##:-------------------------------------
    s3CreateBucket: function (bucketname) {

        var s3 = new AWS.S3();
        s3.createBucket({Bucket: bucketname}, function (err) {
            if (err) {
                console.log("AWS Error:", err);
                return false;
            }
            return true;
        });

    },

    s3UploadFile: function (bucketname, filepath, filename) {

        var fs = require('fs');
        var s3 = new AWS.S3();
        s3.createBucket({Bucket: bucketname}, function (err) {
            if (err) {
                console.log("s3UploadFile() -> AWS Error:", err);
                return false;
            }

            //Open the file and upload it to s3
            fs.readFile(filepath, function (err, data) {
                if (err) {
                    console.log("s3UploadFile() -> FILE Error:", err);
                    return false;
                }

                var params = {
                    Key: filename,
                    Body: data,
                    Bucket: bucketname,
                    ACL: "public-read"
                };
                s3.upload(params, function (err, data) {
                    // Whether there is an error or not, delete the temp file
                    fs.unlink(filepath, function (err) {
                        if (err) {
                            console.error(err);
                        }
                        console.log('Temp File Delete');
                    });

                    console.log("PRINT FILE:", filepath);
                    if (err) {
                        console.log('ERROR MSG: ', err);
                        //res.status(500).send(err);
                    } else {
                        console.log('Successfully uploaded data');
                        //res.status(200).end();
                    }
                });
            });

            return true;
        });

    },

    rebuildShowFeed: function (show) {
        var RSS = require('rss');

        var feed = new RSS({
            title: getShowTitle(show)
        });
    },

    addEpisodeToFeed: function (show, episode) {

    },

    //##: Create an RSS feed for a new show
    newShowFeed: function (show) {
        var RSS = require('rss');


    },

    //##: Get the title of a show
    getShowTitle: function (showid) {
        //##: Need to have a show show id for lookup
        if (!showid) {
            console.log("ERROR: showBuilder.getShowTitle() - No showid given.");
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
            collectionShows.find({
                "_id": objectShowId
            }).toArray(function (err, records) {

                //##: If a record already existed for this show title give back an error
                if (records.length === 0) {
                    console.log("ERROR: showBuilder.getShowTitle() - No show with this id found: [" + showid + "].");
                    return false;
                }

                //##: DEBUG
                if (records[0]._id.toString() === showid) {
                    console.log("DEBUG(database) Found Show id: [" + records[0]._id + "]");
                    return records[0]._id;
                } else {
                    console.log("DEBUG(database) Show id type mismatch [" + typeof records[0]._id + " | " + typeof showid + "]");
                    console.log(records[0]._id);
                    return false;
                }
            });
        });
    }

};