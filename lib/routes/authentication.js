"use strict";

var cookieParser = require('cookie-parser'),
    basicAuth    = require('basic-auth'),
    utils        = require('../utils'),
    uuids        = require('../uuids'),
    Promise      = require('bluebird');

var SECTION = 'couch_httpd_auth';
var KEY = 'authentication_db';

module.exports = function (app) {
  var usersDBPromise, refreshUsersDBImpl;

  utils.requires(app, 'config-infrastructure');
  utils.requires(app, 'logging-infrastructure');

  app.couchConfig.registerDefault(SECTION, KEY, '_users');

  // explain how to activate the auth db logic.
  app.dbWrapper.registerWrapper(function (name, db, next) {
    if (name === getUsersDBName()) {
      return db.useAsAuthenticationDB();
    }
    return next();
  });

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-auth'));

      refreshUsersDBImpl = function () {
        usersDBPromise = utils.getUsersDB(app, PouchDB);
      };
      refreshUsersDB();
      PouchDB.on('destroyed', onDestroyed);
    },
    stop: function (PouchDB) {
      PouchDB.removeListener('destroyed', onDestroyed);
    }
  });

  // utils
  var getUsersDBName = utils.getUsersDBName.bind(null, app);

  function getUsersDB() {
    if (!usersDBPromise) {
      return new Promise(function (resolve) {
        setImmediate(function () {
          resolve(getUsersDB());
        });
      });
    }
    return usersDBPromise;
  }

  function onDestroyed(dbName) {
    // if the users db was removed, it should re-appear.
    if (dbName === getUsersDBName()) {
      refreshUsersDB();
    }
  }

  function refreshUsersDB() {
    return refreshUsersDBImpl();
  }

  // ensure there's always a users db
  app.couchConfig.on(SECTION + '.' + KEY, refreshUsersDB);

  // routing
  app.use(cookieParser());

  app.use(function (req, res, next) {
    // TODO: TIMING ATTACK
    Promise.resolve().then(function () {
      return buildCookieSession(req);
    }).catch(function (err) {
      return buildBasicAuthSession(req);
    }).then(function (result) {
      req.couchSession = result;
      req.couchSession.info.authentication_handlers = ['cookie', 'default'];
      next();
    }).catch(function (err) {
      utils.sendError(res, err);
    });
  });

  function buildCookieSession(req) {
    var opts = {
      sessionID: (req.cookies || {}).AuthSession,
      admins: app.couchConfig.getSection("admins")
    };
    if (!opts.sessionID) {
      throw new Error("No cookie, so no cookie auth.");
    }
    return getUsersDB().then(function (db) {
      return db.session(opts);
    }).then(function (result) {
      if (result.info.authenticated) {
        result.info.authenticated = 'cookie';
        logSuccess('cookie', result);
      }
      return result;
    });
  }

  function logSuccess(type, session) {
    var msg = 'Successful ' + type + ' auth as: "' + session.userCtx.name + '"';
    app.couchLogger.debug(msg);
  }

  function buildBasicAuthSession(req) {
    var userInfo = basicAuth(req);
    var opts = {
      sessionID: uuids(1)[0],
      admins: app.couchConfig.getSection("admins")
    };
    var db;
    var initializingDone = getUsersDB().then(function (theDB) {
      db = theDB;
    });
    if (userInfo) {
      initializingDone = initializingDone.then(function () {
        return db.logIn(userInfo.name, userInfo.pass, opts);
      });
    }
    var result;
    return initializingDone.then(function () {
      return db.session(opts);
    }).then(function (theSession) {
      result = theSession;

      // Cleanup
      return db.logOut(opts);
    }).then(function () {
      if (result.info.authenticated) {
        logSuccess('http basic', result);
        result.info.authenticated = 'default';
      }
      return result;
    });
  }
};
