"use strict";

var utils            = require('./utils'),
    enableReplicator = require('./replicator'),
    enableValidation = require('./validation'),
    enableDiskSize   = require('./disk_size'),
    wrappers         = require('pouchdb-wrappers'),
    express          = require('express'),
    CouchConfig      = require('./couch_config'),
    DatabaseWrapper  = require('./db_wrapper'),
    DaemonManager    = require('./daemon_manager'),
    CouchLogger      = require('./couch_logger'),
    Promise          = require('bluebird');

function fullServer(startPouchDB, opts) {
  var currentPouchDB;

  // both PouchDB and opts are optional
  if (startPouchDB && !startPouchDB.defaults) {
    opts = startPouchDB;
    startPouchDB = null;
  }
  if (!opts) {
    opts = {};
  }

  var app = express();
  app.couchConfig = new CouchConfig(opts.configPath || './config.json');
  app.dbWrapper = new DatabaseWrapper();

  // logging
  app.couchConfig.registerDefault('log', 'file', './log.txt');
  app.couchConfig.registerDefault('log', 'level', 'info');
  var getFile = app.couchConfig.get.bind(app.couchConfig, 'log', 'file');
  var getLevel = app.couchConfig.get.bind(app.couchConfig, 'log', 'level');
  app.couchLogger = new CouchLogger(getFile(), getLevel());
  app.couchConfig.on('log.file', function () {
    app.couchLogger.setFile(getFile());
  });
  app.couchConfig.on('log.level', function () {
    app.couchLogger.setLevel(getLevel());
  });

  app.daemonManager = new DaemonManager();
  app.setPouchDB = function (newPouchDB) {
    var oldPouchDB = currentPouchDB;
    currentPouchDB = newPouchDB;

    var stoppingDone = Promise.resolve();
    if (oldPouchDB) {
      stoppingDone = app.daemonManager.stop(oldPouchDB);
    }
    return stoppingDone.then(function () {
      return app.daemonManager.start(newPouchDB);
    });
  };

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      require('pouchdb-all-dbs')(PouchDB);

      // add PouchDB.new() - by default it just returns 'new PouchDB()'
      wrappers.installStaticWrapperMethods(PouchDB, {});
    }
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    //'fix' the PouchDB api (support opts arg everywhere)
    function noop(orig, args) {
      return orig();
    }
    // TODO: expand
    wrappers.installWrapperMethods(db, {info: noop});
    return next();
  });

  app.use(require('compression')());
  app.use(function (req, res, next) {
    var prop;

    // Normalize query string parameters for direct passing
    // into PouchDB queries.
    for (prop in req.query) {
      if (req.query.hasOwnProperty(prop)) {
        try {
          req.query[prop] = JSON.parse(req.query[prop]);
        } catch (e) {}
      }
    }

    // Provide the request access to the current PouchDB object.
    if (!currentPouchDB) {
      var msg = "express-pouchdb needs a PouchDB object to route a request!";
      throw new Error(msg);
    }
    req.PouchDB = currentPouchDB;

    next();
  });

  enableDiskSize(app);
  enableReplicator(app);

  // load the rules
  utils.loadRoutesIn([
    './routes/authentication',
    './routes/authorization',
    './routes/vhosts',
    './routes/rewrite',
    './routes/http_log',
    './routes/root',
    './routes/log',
    './routes/session',
    './routes/fauxton',
    './routes/config',
    './routes/uuids',
    './routes/all_dbs',
    './routes/replicate',
    './routes/db',
    './routes/bulk_docs',
    './routes/all_docs',
    './routes/changes',
    './routes/compact',
    './routes/revs_diff',
    './routes/security',
    './routes/views',
    './routes/ddoc_info',
    './routes/show',
    './routes/list',
    './routes/update',
    './routes/attachments',
    './routes/documents'
  ], app);

  enableValidation(app);

  // 404 handler
  app.use(function (req, res, next) {
    utils.sendJSON(res, 404, {
      error: "not_found",
      reason: "missing"
    });
  });

  if (startPouchDB) {
    app.setPouchDB(startPouchDB);
  }

  return app;
}

module.exports = fullServer;
