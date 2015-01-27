"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Query a document view
  app.get('/:db/_design/:id/_view/:view', function (req, res, next) {
    var query = req.params.id + '/' + req.params.view;
    var opts = utils.makeOpts(req, req.query);
    req.db.query(query, opts, utils.sendCallback(res));
  });
};
