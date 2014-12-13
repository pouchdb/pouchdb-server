"use strict";

var pkg    = require('../../package'),
    events = require('events'),
    utils  = require('../utils');

module.exports = function (app, PouchDB) {
  // init DbUpdates
  var couchDbUpdates = new events.EventEmitter();

  PouchDB.on('created', function (dbName) {
    couchDbUpdates.emit('update', {db_name: dbName, type: 'created'});
  });

  PouchDB.on('destroyed', function (dbName) {
    couchDbUpdates.emit('update', {db_name: dbName, type: 'deleted'});
  });

  // Routing
  // Root route, return welcome message
  app.get('/', function (req, res, next) {
    utils.sendJSON(res, 200, {
      'express-pouchdb': 'Welcome!',
      'version': pkg.version
    });
  });

  app.all('/_db_updates', function (req, res, next) {
    // TODO: implement
    res.status(400).end();
    // app.couch_db_updates.on('update', function(update) {
    //   sendJSON(res, 200, update);
    // });
  });

  // Log (stub for now)
  app.get('/_log', function (req, res, next) {
    // TODO: implement
    utils.sendJSON(res, 200, '_log is not implemented yet. PRs welcome!');
  });

  // Stats (stub for now)
  app.get('/_stats', function (req, res, next) {
    // TODO: implement
    utils.sendJSON(res, 200, {
      'pouchdb-server': 'has not impemented _stats yet. PRs welcome!'
    });
  });

  // Active tasks (stub for now)
  app.get('/_active_tasks', function (req, res, next) {
    // TODO: implement
    utils.sendJSON(res, 200, []);
  });
};
