"use strict";

var express = require('express');
var path = require('path');

module.exports = function (app) {
  app.use('/_utils/js', express.static(__dirname + '/../../fauxton/js'));
  app.use('/_utils/css', express.static(__dirname + '/../../fauxton/css'));
  app.use('/_utils/img', express.static(__dirname + '/../../fauxton/img'));
  app.use('/_utils/fonts', express.static(__dirname + '/../../fauxton/fonts'));

  app.get('/_utils', function (req, res, next) {
    // We want to force /_utils to /_utils/ as this is the CouchDB behavior
    // https://github.com/apache/couchdb-couch/blob/a431e65713095f1fa99101e14835e89f21b5d82b/src/couch_httpd_misc_handlers.erl#L78
    // https://github.com/apache/couchdb-couch/blob/a431e65713095f1fa99101e14835e89f21b5d82b/src/couch_httpd.erl#L974
    if(req.originalUrl === '/_utils'){
      res.redirect(301, '/_utils/');
    } else {
      res.sendFile(path.normalize(__dirname + '/../../fauxton/index.html'));
    }
  });
};
