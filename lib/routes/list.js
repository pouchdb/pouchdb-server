"use strict";

var utils = require('../utils');

module.exports = function (app, PouchDB) {
  PouchDB.plugin(require('pouchdb-list'));

  // Query design document list handler
  function handler(req, res, next) {
    var query = [req.params.id, req.params.func, req.params.view].join("/");
    var opts = utils.expressReqToCouchDBReq(req);
    req.db.list(query, opts, utils.sendCouchDBResp.bind(null, res));
  }
  app.all('/:db/_design/:id/_list/:func/:view', utils.parseRawBody, handler);
};
