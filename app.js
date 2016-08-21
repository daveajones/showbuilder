var mongodb = require('mongodb');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
//var bodyParser = require('body-parser');
var bb = require('express-busboy');


var routes = require('./routes/index');
var apiv1 = require('./routes/api-v1');
var home = require('./routes/home');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
// app.use(bodyParser.json({limit: '200mb'}));
// app.use(bodyParser.urlencoded({limit: '200mb', extended: true}));
// app.use(bodyParser({uploadDir: './uploads'}));
app.use(cookieParser(process.env.cgsbSecurityCookieParserKey));
app.use(cookieSession({secret:process.env.cgsbSecurityCookieSessionKey}));
app.use(express.static(path.join(__dirname, 'public')));

//File Upload middleware
bb.extend(app, {
    upload: true,
    path: path.join(__dirname, 'uploads'),
    allowedPath: /./
});


//routes
app.use('/', routes);
app.use('/api/v1', apiv1);
app.use('/home', home);

/*
TODO: remove error display to users during production: res.render('error')
      needs to change so it doesn't give environment details away
 */

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.locals.pretty = true;
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;