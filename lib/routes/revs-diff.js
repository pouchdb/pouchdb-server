"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Revs Diff
  app.post('/:db/_revs_diff', utils.jsonParser, function (req, res, next) {
    req.db.revsDiff(req.body || {}, utils.makeOpts(req), function (err, diffs) {
      if (err) {
        return utils.sendJSON(res, err);
      }

      utils.sendJSON(res, 200, diffs);
    });
  });
};
