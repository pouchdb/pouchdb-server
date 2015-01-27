"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Temp Views
  app.post('/:db/_temp_view', utils.jsonParser, function (req, res, next) {
    /*jshint evil: true*/
    if (req.body.map) {
      req.body.map = (new Function('return ' + req.body.map))();
    }
    req.query.conflicts = true;
    var opts = utils.makeOpts(req, req.query);
    req.db.query(req.body, opts, utils.sendCallback(res));
  });
};
