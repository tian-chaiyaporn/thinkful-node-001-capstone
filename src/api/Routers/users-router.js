const {BasicStrategy} = require('passport-http');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const jsonParser = require('body-parser').json();
const urlParser = require('body-parser').urlencoded({     // to support URL-encoded bodies
  extended: true
});
const passport = require('passport');

const router = express.Router();
const {User} = require('../Models/User');
const {Decision} = require('../Models/Decision');

mongoose.Promise = global.Promise;

const basicStrategy = new BasicStrategy((username, password, callback) => {
  let user;

  // callback(null, { id: 1, user: 'root' });
  // return;

  User
    .findOne({username: username})
    .exec()
    .then(_user => {
      user = _user;
      if (!user) {
        return callback(null, false);
      }
      return user.validatePassword(password);
    })
    .then(isValid => {
      if (!isValid) {
        return callback(null, false);
      }
      else {
        return callback(null, user);
      }
    })
    .catch(err => callback(err));
});

passport.use(basicStrategy);
router.use(passport.initialize());
const secretString = Buffer('super-secret-string').toString('base64')
router.use(session({
  secret: secretString,
  resave: false,
  saveUninitialized: false
}));
router.use(passport.session());
router.use(jsonParser);
router.use(urlParser);

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// create new user
router.post('/', (req, res) => {
  if (!req.body) {
    return res.status(400).json({message: 'No request body'});
  }

  let {username, password} = req.body;

  if (!(username)) {
    return res.status(422).json({message: 'Missing field: username'});
  }
  if (typeof username !== 'string') {
    return res.status(422).json({message: 'Incorrect field type: username'});
  }
  username = username.trim();
  if (username === '') {
    return res.status(422).json({message: 'Incorrect field length: username'});
  }

  if (!(password)) {
    return res.status(422).json({message: 'Missing field: password'});
  }
  if (typeof password !== 'string') {
    return res.status(422).json({message: 'Incorrect field type: password'});
  }
  password = password.trim();
  if (password === '') {
    return res.status(422).json({message: 'Incorrect field length: password'});
  }

  // check for existing user
  return User
    .find({username})
    .count()
    .exec()
    .then(count => {
      if (count > 0) {
        return res.status(422).json({message: 'username already taken'});
      }
      return User.hashPassword(password)
    })
    .then(hash => {
      return User
        .create({
          username: username,
          password: hash
        })
    })
    .then(user => {
      return res.status(201).json({userId: user._id});
    })
    .catch(err => {
      res.status(500).json({message: 'Internal server error'})
    });
});

// log user in
router.post('/login',
  passport.authenticate('basic', {session: true}),
  (req, res) => {
    console.log(req.user);
    res.status(201).json(req.user._id);
});

// sends json for all the dice created/saved by the user
router.get('/:id',
  // passport.authenticate('basic', {session: false}),
  (req, res) => {
    if (!req.user) {
      console.log("no req.user param, thus no log in");
      res.status(500).json({message: 'User not logged in'})
    } else {
      console.log('user-id path receiving request');
      return User
        .find(req.body.id)
        .exec()
        .then(users => {
          decisions = [];
          users.decision_id.forEach(id => {
            Decision
              .findById(id)
              .exec()
              .then(decision => {
                decisions.push(decision);
              })
          })
          .then(() => res.json(decisions))
        })
        .catch(err => {
          console.log(err);
          res.status(500).json({message: 'Internal server error for /user/:id'})
        });
    }
});

module.exports = router;