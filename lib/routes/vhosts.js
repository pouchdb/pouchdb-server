"use strict";

var utils = require('../utils');

module.exports = function (app, PouchDB) {
  require('pouchdb-vhost')(PouchDB);

  // Query design document rewrite handler
  app.use(function (req, res, next) {
    var couchReq = utils.expressReqToCouchDBReq(req);
    var vhosts = app.couchConfig.getSection('vhosts');
    var newUrl = PouchDB.resolveVirtualHost(couchReq, vhosts);

    if (newUrl !== req.url) {
      req.url = newUrl;
      console.log("VirtualHost rewrite to: " + req.url);
    }
    next();
  });
};
