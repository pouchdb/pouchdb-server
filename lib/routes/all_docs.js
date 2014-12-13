"use strict";

var utils  = require('../utils'),
    extend = require('extend');

module.exports = function (app) {
  // All docs operations
  app.all('/:db/_all_docs', utils.jsonParser, function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return next();
    }

    // Check that the request body, if present, is an object.
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return utils.sendJSON(res, 400, {
        reason: "Something wrong with the request",
        error: 'bad_request'
      });
    }

    var opts = utils.makeOpts(req, extend({}, req.body, req.query));
    req.db.allDocs(opts, function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.sendJSON(res, 200, response);
    });

  });
};
