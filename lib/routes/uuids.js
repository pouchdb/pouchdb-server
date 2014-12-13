"use strict";

var utils = require('../utils'),
    uuids = require('../uuids');

module.exports = function (app) {
  // Generate UUIDs
  app.all('/_uuids', utils.restrictMethods(["GET"]), function (req, res, next) {
    res.set({
      "Cache-Control": "must-revalidate, no-cache",
      "Pragma": "no-cache"
    });
    var count = typeof req.query.count === 'number' ? req.query.count : 1;
    utils.sendJSON(res, 200, {
      uuids: uuids(count)
    });
  });
};
