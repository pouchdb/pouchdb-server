"use strict";

/*globals before */

var buildApp = require('..'),
    PouchDB  = require('pouchdb'),
    express  = require('express'),
    request  = require('supertest'),
    Promise  = require('bluebird'),
    fse      = Promise.promisifyAll(require('fs-extra')),
    memdown  = require('memdown');

var TEST_DATA = __dirname + '/testdata/';
var LARGE_TIMEOUT = 5000;

var expressApp, expressApp2;

var customApp = buildApp(PouchDB.defaults({
  db: memdown,
  prefix: 'c'
}), {
  mode: 'custom',
  overrideMode: {
    include: ['routes/404']
  }
});

var coreApp = buildApp(PouchDB.defaults({
  db: memdown,
  prefix: 'd'
}), {
  mode: 'minimumForPouchDB',
});

before(function (done) {
  this.timeout(LARGE_TIMEOUT);
  fse.removeAsync(TEST_DATA).then(function () {
    return fse.mkdirsAsync(TEST_DATA + 'a');
  }).then(function () {
    return fse.mkdirsAsync(TEST_DATA + 'b');
  }).then(function () {
    expressApp = buildApp(PouchDB.defaults({
      prefix: TEST_DATA + 'a/'
    }));
    expressApp2 = buildApp(PouchDB.defaults({
      prefix: TEST_DATA + 'b/',
    }), {
      configPath: TEST_DATA + 'b-config.json'
    });
    done();
  }).catch(done);
});

after(function (done) {
  fse.removeAsync('./config.json').then(function () {
    fse.remove('./log.txt', done);
  }).catch(done);
});

var prefixes = ['/', '/db/'];

prefixes.forEach(function (prefix) {
  describe('basics for ' + prefix, function () {
    it('GET / should respond with a welcome page', function (done) {
      var app = express();
      app.use(prefix, expressApp);

      testWelcome(app, done, prefix);
    });
  });
});

function testWelcome(app, done, path) {
  request(app)
    .get(path)
    .expect(200)
    .expect(function (res) {
      if (!/Welcome!/.test(res.text)) {
        return "No 'Welcome!' in response";
      }
    })
    .end(done);
}

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

describe('modes', function () {
  it('should always return a 404 in our custom configuration', function (done) {
    request(customApp)
      .get('/')
      .expect(404)
      .expect(function (res) {
        if (JSON.parse(res.text).error !== 'not_found') {
          return "Wrong response body";
        }
      })
      .end(done);
  });
  it('should generate a functioning core app', function (done) {
    testWelcome(coreApp, done, '/');
  });
  it('should throw an error when given an invalid mode', function () {
    assertException(function () {
      buildApp(PouchDB, {mode: 'unexisting-mode'});
    }, /Unknown mode: unexisting-mode/);
  });
  it('should throw an error when a not included part is excluded', function () {
    assertException(function () {
      buildApp(PouchDB, {overrideMode: {exclude: ['abc']}});
    }, /exclude contains the not included part 'abc'/);
  });
  it('should throw an error when an unknown part is included', function () {
    assertException(function () {
      buildApp(PouchDB, {overrideMode: {include: ['abc']}});
    }, /include contains the unknown part 'abc'/);
  });
});

function assertException(func, re) {
  var e;
  try {
    func();
  } catch (err) {
    if (re.test(err.toString())) {
      return;
    }
    e = err;
  }
  throw (e || new Error('no error was thrown'));
}
