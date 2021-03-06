require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Mongo
const MongoClient = require('mongodb').MongoClient;
const mongoose = require('mongoose');

// Security
const compression = require('compression');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// Sessions
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

// Passport.Js
const User = require('./models/user');
const passport = require('passport');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var adminsRouter = require('./routes/admins');
var ajaxRouter = require('./routes/ajax');

var app = express();

// Helmet
app.use(helmet());

// Compress responses
app.use(compression());

// Setup body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '100kb' }));

// Setup express-rate-limit middleware
app.set('trust proxy', 1);  // Trust AWS reverse proxy
const limiter = rateLimit({
  windowMS: 1000 * 60 * 15, // 15 min in ms
  max: 200, // Max requests per 15 min window
  message: 'You have exceeded the maximum amount of requests!',
  headers: true // Send the appropriate headers to the response (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After)
});

// Setup express-mongo-sanitize to protect against NoSQL Injection Attacks
app.use(mongoSanitize({ replaceWith: '_' }));

app.use(limiter);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Setup mongoose connection
const connectMongo = async () => {
  await mongoose.connect(process.env.DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true
  });
};
connectMongo();
mongoose.Promise = global.Promise;

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error: '));
db.once('open', function () {
  console.log('Connected to DB');
});

// Session Middleware
app.use(session({
  secret: process.env.SECRET,
  saveUninitialized: false,
  resave: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.url = req.path;
  next();
});

// Setup Root Routes
app.use('/', indexRouter);
app.use('/usuarios', usersRouter);
app.use('/admin', adminsRouter);
app.use('/ajax', ajaxRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.locals.error = req.app.get('env') === 'development' ? err : err.status;

  // render the error page
  res.status(err.status || 500);
  req.app.get('env') === 'development'
    ? res.render('error')
    : res.render('errorprod');
});

module.exports = app;
