"use strict";

var pkg    = require('../../package'),
    utils  = require('../utils'),
    uuids  = require('../uuids');

module.exports = function (app) {
  if (app.couchConfig) {
    app.couchConfig.registerDefault('vendor', 'name', 'PouchDB authors');
    app.couchConfig.registerDefault('vendor', 'version', pkg.version);
  }
  // Root route, return welcome message
  app.get('/', function (req, res, next) {
    var json = {
      'express-pouchdb': 'Welcome!',
      'version': pkg.version
    };
    function sendResp() {
      utils.sendJSON(res, 200, json);
    }
    if (app.couchConfig) {
      json.vendor = app.couchConfig.getSection('vendor');
      getServerUUID(app.couchConfig, function (uuid) {
        json.uuid = uuid;
        sendResp();
      });
    } else {
      sendResp();
    }
  });
};

function getServerUUID(config, cb) {
  var uuid = config.get('couchdb', 'uuid');
  if (uuid) {
    return cb(uuid);
  }
  uuid = uuids(1)[0];
  config.set('couchdb', 'uuid', uuid, function () {
    cb(uuid);
  });
}
