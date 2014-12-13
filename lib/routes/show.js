"use strict";

var utils = require('../utils');

module.exports = function (app, PouchDB) {
  PouchDB.plugin(require('pouchdb-show'));

  // Query design document show handler
  function handler(req, res, next) {
    var query = [req.params.id, req.params.func, req.params.docid].join("/");
    var opts = utils.expressReqToCouchDBReq(req);
    req.db.show(query, opts, utils.sendCouchDBResp.bind(null, res));
  }
  app.all('/:db/_design/:id/_show/:func/:docid?', utils.parseRawBody, handler);
};
