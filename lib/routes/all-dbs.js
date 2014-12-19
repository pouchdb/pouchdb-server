"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // List all databases.
  app.get('/_all_dbs', function (req, res, next) {
    req.PouchDB.allDbs(function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }

      //hack until pouchdb-all-dbs filter out dependant dbs.
      response = response.filter(function (name) {
        return name.indexOf("-session-") !== 0;
      });
      utils.sendJSON(res, 200, response);
    });
  });
};
