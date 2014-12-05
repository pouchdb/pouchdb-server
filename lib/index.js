"use strict";

var utils            = require('./utils'),
    enableReplicator = require('./replicator'),
    enableValidation = require('./validation'),
    enableDiskSize   = require('./disk_size'),
    wrappers         = require('pouchdb-wrappers');

function fullServer(PouchDB, app, config, dbWrapper) {
  // add PouchDB.new() - by default it just returns 'new PouchDB()'
  wrappers.installStaticWrapperMethods(PouchDB, {});
  require('pouchdb-all-dbs')(PouchDB);

  app = utils.getApp(app);
  config = utils.getConfig(config);
  dbWrapper = utils.getDBWrapper(dbWrapper);

  dbWrapper.registerWrapper(function (name, db, next) {
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
    next();
  });

  enableDiskSize(PouchDB, app, config, dbWrapper);
  enableReplicator(PouchDB, app, config, dbWrapper);

  // load the rules
  utils.loadRoutesIn([
    './routes/auth',
    './routes/rewrite',
    './routes/root',
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
  ], PouchDB, app, config, dbWrapper);

  enableValidation(PouchDB, app, config, dbWrapper);

  // 404 handler
  app.use(function (req, res, next) {
    utils.sendJSON(res, 404, {
      error: "not_found",
      reason: "missing"
    });
  });

  return app;
}

module.exports = fullServer;
