"use strict";

/*globals before */

var buildApp = require('..'),
    PouchDB  = require('pouchdb'),
    express  = require('express'),
    request  = require('supertest'),
    fse      = require('fs-extra');

var TEST_DATA = __dirname + '/testdata/';
var LARGE_TIMEOUT = 5000;

var expressApp, expressApp2;

before(function (done) {
  this.timeout(LARGE_TIMEOUT);
  fse.remove(TEST_DATA, function (err) {
    if (err) {
      return done(err);
    }
    fse.mkdirs(TEST_DATA + 'a', function (err) {
      if (err) {
        return done(err);
      }
      fse.mkdirs(TEST_DATA + 'b', function (err) {
        if (err) {
          return done(err);
        }
        expressApp = buildApp(PouchDB.defaults({
          prefix: TEST_DATA + 'a/'
        }));
        expressApp2 = buildApp(PouchDB.defaults({
          prefix: TEST_DATA + 'b/',
        }), {
          configPath: TEST_DATA + 'b-config.json'
        });
        done();
      });
    });
  });
});

after(function (done) {
  fse.remove('./config.json', function (err) {
    if (err) {
      return done(err);
    }
    fse.remove('./log.txt', done);
  });
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

describe('config', function () {
  it('should have ./config.json as default config path', function (done) {
    fse.exists('./config.json', function (exists) {
      if (!exists) {
        return done(new Error("config.json doesn't exist!"));
      }
      done();
    });
  });
  it('should support setting a different config path', function (done) {
    fse.exists(TEST_DATA + 'b-config.json', function (exists) {
      if (!exists) {
        return done(new Error("b-config.json doesn't exist!"));
      }
      done();
    });
  });
  it('should support externally adding a default', function (done) {
    expressApp.couchConfig.registerDefault('a', 'b', 'c');
    request(expressApp)
      .get('/_config')
      .expect(200)
      .expect(function (res) {
        var a = JSON.parse(res.text).a;
        if (!(typeof a === "object" && a.b === "c")) {
          return "Default not shown";
        }
      })
      .end(done);
  });
  it('should support externally getting a config value', function (done) {
    request(expressApp)
      .put('/_config/test/a')
      .send('"b"')
      .expect(200)
      .end(function () {
        if (expressApp.couchConfig.get('test', 'a') !== 'b') {
          return done(new Error("Can't read setting that's just been set"));
        }
        done();
      });
  });
  it('should support external listeners to a config change', function (done) {
    var changed = false;
    expressApp.couchConfig.on('test2.a', function () {
      changed = true;
    });
    request(expressApp)
      .put('/_config/test2/a')
      .send('"b"')
      .expect(200)
      .expect(function (res) {
        if (!changed) {
          return "Didn't get notice of the setting change";
        }
      })
      .end(done);
  });
});
