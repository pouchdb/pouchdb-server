"use strict";

var express = require('express');
var path = require('path');

var FAUXTON_PATH = __dirname + '/../../node_modules/pouchdb-fauxton/www';

module.exports = function (app) {
  app.get('/_utils', function (req, res) {
    /* jshint maxlen:false */
    // We want to force /_utils to /_utils/ as this is the CouchDB behavior
    // https://github.com/apache/couchdb-couch/blob/a431e65713095f1fa99101e14835e89f21b5d82b/src/couch_httpd_misc_handlers.erl#L78
    // https://github.com/apache/couchdb-couch/blob/a431e65713095f1fa99101e14835e89f21b5d82b/src/couch_httpd.erl#L974
    if (req.originalUrl === '/_utils') {
      res.redirect(301, '/_utils/');
    } else {
      res.sendFile(path.normalize(FAUXTON_PATH + '/index.html'));
    }
  });

  app.use('/_utils', express.static(FAUXTON_PATH));
};
