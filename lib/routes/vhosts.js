"use strict";

var utils = require('../utils');

module.exports = function (PouchDB, app, config) {
  require('pouchdb-vhost')(PouchDB);

  // Query design document rewrite handler
  app.use(function (req, res, next) {
    var couchReq = utils.expressReqToCouchDBReq(req);
    var newUrl = PouchDB.resolveVirtualHost(couchReq, config.getSection('vhosts'));

    if (newUrl !== req.url) {
      req.url = newUrl;
      console.log("VirtualHost rewrite to: " + req.url);
    }
    next();
  });
};
