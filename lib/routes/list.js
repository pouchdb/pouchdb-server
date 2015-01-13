"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-list'));
    }
  });

  // Query design document list handler
  function handler(req, res, next) {
    var query = [req.params.id, req.params.func, req.params.view].join("/");
    var cb = utils.sendCouchDBResp.bind(null, res);
    req.db.list(query, req.couchDBReq, cb);
  }
  app.all('/:db/_design/:id/_list/:func/:view',
    utils.couchDBReqMiddleware, handler
  );
};
