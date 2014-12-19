"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-update'));
    }
  });

  // Query design document update handler
  app.all(
    '/:db/_design/:id/_update/:func/:docid?',
    utils.parseRawBody,
    function (req, res, next) {
      var query = [req.params.id, req.params.func, req.params.docid].join("/");
      var opts = utils.expressReqToCouchDBReq(req);
      req.db.update(query, opts, utils.sendCouchDBResp.bind(null, res));
    }
  );
};
