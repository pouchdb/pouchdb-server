"use strict";

var cookieParser = require('cookie-parser'),
    basicAuth    = require('basic-auth'),
    utils        = require('../utils'),
    uuids        = require('../uuids'),
    Promise      = require('bluebird');

var SECTION = 'couch_httpd_auth';
var KEY = 'authentication_db';

module.exports = function (app, PouchDB) {
  var usersDBPromise;

  PouchDB.plugin(require('pouchdb-auth'));
  app.couchConfig.registerDefault(SECTION, KEY, '_users');

  // explain how to activate the auth db logic.
  app.dbWrapper.registerWrapper(function (name, db, next) {
    if (name === getUsersDBName()) {
      return db.useAsAuthenticationDB();
    }
    return next();
  });

  // utils
  var getUsersDBName = utils.getUsersDBName.bind(null, app);

  function refreshUsersDB() {
    usersDBPromise = utils.getUsersDB(app, PouchDB);
  }

  // ensure there's always a users db
  refreshUsersDB();
  app.couchConfig.on(SECTION + '.' + KEY, refreshUsersDB);
  PouchDB.on('destroyed', function (dbName) {
    // if the users db was removed, it should re-appear.
    if (dbName === getUsersDBName()) {
      refreshUsersDB();
    }
  });

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
    return usersDBPromise.then(function (db) {
      return db.session(opts);
    }).then(function (result) {
      if (result.info.authenticated) {
        result.info.authenticated = 'cookie';
      }
      return result;
    });
  }

  function buildBasicAuthSession(req) {
    var userInfo = basicAuth(req);
    var opts = {
      sessionID: uuids(1)[0],
      admins: app.couchConfig.getSection("admins")
    };
    var db;
    var initializingDone = usersDBPromise.then(function (theDB) {
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
        result.info.authenticated = 'default';
      }
      return result;
    });
  }

  // routes that need server admin protection
  app.get('/_config', requiresServerAdmin);
  app.get('/_config/:section', requiresServerAdmin);
  app.get('/_config/:section/:key', requiresServerAdmin);
  app.put('/_config/:section/:key', requiresServerAdmin);
  app.delete('/_config/:section/:key', requiresServerAdmin);

  app.get('/_log', requiresServerAdmin);
  app.get('/_active_tasks', requiresServerAdmin);
  app.get('/_db_updates', requiresServerAdmin);

  function requiresServerAdmin(req, res, next) {
    if (req.couchSession.userCtx.roles.indexOf('_admin') !== -1) {
      return next();
    }
    utils.sendJSON(res, 401, {
      error: 'unauthorized',
      reason: "You are not a server admin."
    });
  }
};
