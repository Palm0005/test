/*

  Welcome to Histograph
  ===

*/
var express      = require('express'),        // call express
    session      = require('express-session'),
    settings     = require('./settings'),

    app          = exports.app = express(),                 // define our app using express
    
    auth         = require('./auth'), // auth mechanism with passport
    
    bodyParser   = require('body-parser'),
    cookieParser = require('cookie-parser'),
    morgan       = require('morgan'),
    
    ctrl         = require('require-all')(__dirname + '/controllers'),

    port         = process.env.PORT || 3000,

    clientRouter = express.Router(),
    apiRouter    = express.Router(),

    _            = require('lodash');        // set our port


// configure logger
app.use(morgan('dev'));

// configure static files and jade templates
app.use(express.static('./client/src'));
app.set('views', './client/views');
app.set('view engine', 'jade');


// configure app to use bodyParser(), this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// configure app to use sessions
app.use(cookieParser());
app.use(session({
  name: 'hg.sid',
  secret: settings.secret.cookie,
  trustProxy: false,
  resave: true,
  saveUninitialized: true
}));


app.use(auth.passport.initialize());
app.use(auth.passport.session());

// enrich express responses
express.response.ok = function(result) {
  return this.json({
    status: 'ok',
    user: this.req.user,
    result: result
  });
};

express.response.error = function(statusCode, err) {
  return this.status(statusCode).json({
    status: 'error',
    error: _.assign({
      code: statusCode,
    }, err)
  });
};


/*
  Client router configuration
*/
clientRouter.route('/').
  get(function(req, res) { // test route to make sure everything is working (accessed at GET http://localhost:8080/api)
    res.render('index', { message: 'hooray! welcome to our api!' });   
  });

clientRouter.route('/login')
  .post(function (req, res, next) {
    auth.passport.authenticate('local', function(err, user, info) {
      if(err) {
        console.log('login error', err)
        return res.error(403, {message: 'not valid credentials'});
      }
      req.logIn(user, function(err) {
        if (err)
          return next(err);
        return res.redirect('/api');
      });
    })(req, res, next)
  });

clientRouter.route('/logout')
  .get(function(req, res){
    req.logout();
    return res.ok({
      user: res.user
    });
  });

clientRouter.route('/signup')
  .post(ctrl.user.signup)

clientRouter.route('/activate')
  .get(ctrl.user.activate)

clientRouter.route('/auth/twitter')
  .get(auth.passport.authenticate('twitter'));

clientRouter.route('/auth/twitter/callback')
  .get(function (req, res, next) {
    auth.passport.authenticate('twitter', function(err, user, info) {
      //console.log('user', user); // handle errors
      req.logIn(user, function(err) {
        if (err)
          return next(err);
        return res.redirect('/');
      });
    })(req, res, next)
  });

/*

  Api router configuration
  ===

*/
apiRouter.use(function(req, res, next) { // middleware to use for all requests
  console.log(req.path);
  if (req.isAuthenticated()) {
    return next();
  }
  return res.error(403);
});

// api index
apiRouter.route('/').
  get(function(req, res) { // test route to make sure everything is working (accessed at GET http://localhost:8080/api)
    res.ok({ message: 'hooray! welcome to our api!' });   
  });

apiRouter.route('/another').
  get(function(req, res) { // test route to make sure everything is working (accessed at GET http://localhost:8080/api)
    res.ok({ message: 'hooray! another!' });   
  });

// api session info
apiRouter.route('/user/session')
  .get(ctrl.user.session)

// apiRouter.route('/user')
//   .post(ctrl.user.create)



// face recognition tests
apiRouter.route('/alchemyapi/image-face-tags')
  .post(ctrl.alchemyapi.imageFaceTags.url)

apiRouter.route('/rekognition/face-detect')
  .post(ctrl.rekognition.faceDetect)

apiRouter.route('/rekognition/face-search')
  .post(ctrl.rekognition.faceSearch)

apiRouter.route('/skybiometry/face-detect')
  .post(ctrl.skybiometry.faceDetect)


/*

 Register our routes
 ===

*/
app.use('/', clientRouter); // client router
app.use('/api', apiRouter); // api endpoint. we should be auth to pass this point.


/*

 START THE SERVER and strat listening with socket.io

*/
var server = app.listen(port),
    io = require('socket.io').listen(server);

// import io events otherwise
io.on('connection', function(socket){
  var cookie_string = socket.request.headers.cookie;
  console.log('a user connected', cookie_string);
  

});