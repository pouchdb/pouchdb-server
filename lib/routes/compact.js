"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // DB Compaction
  app.post('/:db/_compact', utils.jsonParser, function (req, res, next) {
    // don't wait for compaction to finish, but do give errors a chance
    // to pop up by waiting for a little bit. Yes, this is a hack.
    var encounteredError = false;
    req.db.compact(utils.makeOpts(req)).catch(function (err) {
      encounteredError = true;
      return utils.sendError(res, err);
    });
    setTimeout(function () {
      if (!encounteredError) {
        utils.sendJSON(res, 202, {ok: true});
      }
    }, 0);
  });
};
