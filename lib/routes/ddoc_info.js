"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // Query design document info
  app.get('/:db/_design/:id/_info', function (req, res, next) {
    // Dummy data for Fauxton - when implementing fully also take into
    // account req.couchSessionObj - this needs at least db view rights it
    // seems.
    utils.sendJSON(res, 200, {
      'name': req.query.id,
      'view_index': 'Not implemented.'
    });
  });
};
