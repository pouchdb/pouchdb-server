"use strict";

/*globals before */

var buildApp = require('..'),
    PouchDB  = require('pouchdb'),
    express  = require('express'),
    request  = require('supertest'),
    fse      = require('fs-extra');

var TEST_DATA = __dirname + '/testdata/';
var LARGE_TIMEOUT = 5000;

var expressApp;

before(function (done) {
  this.timeout(LARGE_TIMEOUT);
  fse.remove(TEST_DATA, function (err) {
    if (err) {
      return done(err);
    }
    fse.mkdir(TEST_DATA, function (err) {
      if (err) {
        return done(err);
      }
      expressApp = buildApp(PouchDB.defaults({
        prefix: TEST_DATA
      }));
      done();
    });
  });
});

after(function (done) {
  fse.remove('./config.json', done);
});

var prefixes = ['/', '/db/'];

prefixes.forEach(function (prefix) {
  describe('basics for ' + prefix, function () {
    it('GET / should respond with a welcome page', function (done) {
      var app = express();
      app.use(prefix, expressApp);

      request(app)
        .get(prefix)
        .expect(200)
        .expect(function (res) {
          if (!/Welcome!/.test(res.text)) {
            return "No 'Welcome!' in response";
          }
        })
        .end(done);
    });
  });
});
