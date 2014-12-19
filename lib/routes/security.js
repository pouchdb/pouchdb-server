"use strict";

var Security = require('pouchdb-security');
var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(Security);
      Security.installStaticSecurityMethods(PouchDB);
    }
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    db.installSecurityMethods();
    return next();
  });

  // Routing
  ['/:db/*', '/:db'].forEach(function (url) {
    app.use(url, function (req, res, next) {
      req.db.getSecurity().then(function (secObj) {
        req.couchSecurityObj = secObj;

        next();
      });
    });
  });

  app.get('/:db/_security', function (req, res, next) {
    req.db.getSecurity(utils.makeOpts(req), function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }

      utils.sendJSON(res, 200, response);
    });
  });

  app.put('/:db/_security', utils.jsonParser, function (req, res, next) {
    function handler(err, response) {
      if (err) {
        return utils.sendError(res, err);
      }

      utils.sendJSON(res, 200, response);
    }
    req.db.putSecurity(req.body || {}, utils.makeOpts(req), handler);
  });
};
