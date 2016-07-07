"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // DB Compaction
  app.post('/:db/_compact', utils.jsonParser, function (req, res, next) {
    req.db.compact(utils.makeOpts(req), function (err) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.sendJSON(res, 200, {ok: true});
    });
  });
};
