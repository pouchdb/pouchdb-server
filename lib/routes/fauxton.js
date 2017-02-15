"use strict";

var express = require('express');
var path = require('path');

var FAUXTON_PATH = __dirname + '/../../node_modules/pouchdb-fauxton/www';

module.exports = function (app) {
  app.get('/_utils', function (req, res) {
    // We want to force /_utils to /_utils/ as this is the CouchDB behavior
    // https://git.io/vDMOD#L78
    // https://git.io/vDMOQ#L974
    if (req.originalUrl === '/_utils') {
      res.redirect(301, '/_utils/');
    } else {
      res.sendFile(path.normalize(FAUXTON_PATH + '/index.html'));
    }
  });

  app.use('/_utils', express.static(FAUXTON_PATH));
};
