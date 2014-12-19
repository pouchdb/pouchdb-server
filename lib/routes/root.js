"use strict";

var pkg   = require('../../package'),
    utils = require('../utils');

module.exports = function (app) {
  // Root route, return welcome message
  app.get('/', function (req, res, next) {
    utils.sendJSON(res, 200, {
      'express-pouchdb': 'Welcome!',
      'version': pkg.version
    });
  });
};
