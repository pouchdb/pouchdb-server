"use strict";

var express = require('express');
var path = require('path');

module.exports = function (app) {
  app.use('/js', express.static(__dirname + '/../../fauxton/js'));
  app.use('/css', express.static(__dirname + '/../../fauxton/css'));
  app.use('/img', express.static(__dirname + '/../../fauxton/img'));
  app.use('/fonts', express.static(__dirname + '/../../fauxton/fonts'));

  app.get('/_utils', function (req, res, next) {
    res.sendFile(path.normalize(__dirname + '/../../fauxton/index.html'));
  });
};
