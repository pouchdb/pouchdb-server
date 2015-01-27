"use strict";

var utils = require('../utils');

// TODO: /_security considerations? (What's CouchDB going to do there?)
// Should be possible to add that on top by just upgrading
// pouchdb-security though.

module.exports = function (app) {
  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      PouchDB.plugin(require('pouchdb-find'));
    }
  });

  app.get('/:db/_index', function (req, res, next) {
    req.db.getIndexes(utils.sendCallback(res));
  });

  app.post('/:db/_index', utils.jsonParser, function (req, res, next) {
    req.db.createIndex(req.body, utils.sendCallback(res, 400));
  });

  app.delete('/:db/_index/:ddoc/:type/:name', function (req, res, next) {
    req.db.deleteIndex({
      ddoc: req.params.ddoc,
      type: req.params.type,
      name: req.params.name
    }, utils.sendCallback(res));
  });

  app.post('/:db/_find', utils.jsonParser, function (req, res, next) {
    req.db.find(req.body, utils.sendCallback(res, 400));
  });
};
