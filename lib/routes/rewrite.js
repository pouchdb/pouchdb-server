"use strict";

var utils = require('../utils');
var REGEX = /\/([^\/]*)\/_design\/([^\/]*)\/_rewrite\/([^?]*)/;

module.exports = function (app, PouchDB) {
  PouchDB.plugin(require('pouchdb-rewrite'));

  // Query design document rewrite handler
  app.use(function (req, res, next) {
    // Prefers regex over setting the first argument of app.use(), because
    // the last makes req.url relative, which in turn makes most rewrites
    // impossible.
    var match = REGEX.exec(req.url);
    if (!match) {
      return next();
    }
    utils.setDBOnReq(PouchDB, match[1], app.dbWrapper, req, res, function () {
      var query = match[2] + "/" + match[3];
      var opts = utils.expressReqToCouchDBReq(req);
      // We don't know opts.path yet - that's the point.
      delete opts.path;
      req.db.rewriteResultRequestObject(query, opts, function (err, resp) {
        if (err) {
          return utils.sendError(res, err);
        }

        req.rawBody = resp.body;
        req.cookies = resp.cookie;
        req.headers = resp.headers;
        req.method = resp.method;
        req.url = "/" + resp.path.join("/");
        req.query = resp.query;

        console.log("Rewritten to: " + req.url);
        // Handle the newly generated request.
        next();
      });
    });
  });
};
