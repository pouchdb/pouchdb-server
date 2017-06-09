'use strict';

/*globals before */

var buildApp = require('../../packages/node_modules/express-pouchdb'),
  PouchDB = require('pouchdb'),
  express = require('express'),
  request = require('supertest'),
  Promise = require('bluebird'),
  fse = Promise.promisifyAll(require('fs-extra')),
  memdown = require('memdown'),
  assert = require('assert');

var TEST_DATA = __dirname + '/testdata/';
var LARGE_TIMEOUT = 5000;

var expressApp, expressApp2;

var customApp = buildApp(
  PouchDB.defaults({
    db: memdown,
    prefix: 'c'
  }),
  {
    mode: 'custom',
    overrideMode: {
      include: ['routes/404']
    }
  }
);

var coreApp = buildApp(
  PouchDB.defaults({
    db: memdown,
    prefix: 'd'
  }),
  {
    mode: 'minimumForPouchDB',
    overrideMode: {
      include: ['routes/fauxton']
    }
  }
);

var inMemoryConfigApp = buildApp(
  PouchDB.defaults({
    db: memdown,
    prefix: 'e'
  }),
  {
    inMemoryConfig: true
  }
);

before(function (done) {
  this.timeout(LARGE_TIMEOUT);
  cleanUp()
    .then(function () {
      return fse.mkdirsAsync(TEST_DATA + 'a');
    })
    .then(function () {
      return fse.mkdirsAsync(TEST_DATA + 'b');
    })
    .then(function () {
      expressApp = buildApp(
        PouchDB.defaults({
          prefix: TEST_DATA + 'a/'
        })
      );
      expressApp2 = buildApp(
        PouchDB.defaults({
          prefix: TEST_DATA + 'b/'
        }),
        {
          configPath: TEST_DATA + 'b-config.json',
          logPath: TEST_DATA + 'b-log.txt'
        }
      );
      done();
    })
    .catch(done);
});

after(function (done) {
  cleanUp()
    .then(function () {
      done();
    })
    .catch(done);
});

function cleanUp() {
  return Promise.all([
    fse.removeAsync(TEST_DATA),
    fse.removeAsync('./config.json'),
    fse.removeAsync('./log.txt')
  ]);
}

describe('config', function () {
  it('should not create empty config file', function (done) {
    fse.exists('./config.json', function (exists) {
      if (exists) {
        return done(new Error('config.json should not have been created!'));
      }
      done();
    });
  });
  it('should support in memory config', function (done) {
    // make sure the file is written to disk.
    inMemoryConfigApp.couchConfig.set('demo', 'demo', true, function () {
      fse.exists('./config.json', function (exists) {
        if (exists) {
          return done(new Error('config.json exists!'));
        }
        done();
      });
    });
  });
  it('should have ./config.json as default config path', function (done) {
    expressApp.couchConfig.set('demo', 'demo', true, function () {
      fse.exists('./config.json', function (exists) {
        if (!exists) {
          return done(new Error("config.json doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support setting a different config path', function (done) {
    // make sure the file is written to disk.
    expressApp2.couchConfig.set('demo', 'demo', true, function () {
      fse.exists(TEST_DATA + 'b-config.json', function (exists) {
        if (!exists) {
          return done(new Error("b-config.json doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support setting a different log path', function (done) {
    // make sure the file is written to disk.
    expressApp2.couchConfig.set('demo', 'demo', true, function () {
      fse.exists(TEST_DATA + 'b-log.txt', function (exists) {
        if (!exists) {
          return done(new Error("b-log.txt doesn't exist!"));
        }
        done();
      });
    });
  });
  it('should support externally adding a default', function (done) {
    expressApp.couchConfig.registerDefault('a', 'b', 'c');
    request(expressApp)
      .get('/_config')
      .expect(200)
      .expect(function (res) {
        var a = JSON.parse(res.text).a;
        if (!(typeof a === 'object' && a.b === 'c')) {
          return 'Default not shown';
        }
      })
      .end(done);
  });
  it('should support externally getting a config value', function (done) {
    request(expressApp).put('/_config/test/a').send('"b"').expect(200).end(function () {
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
      .expect(function () {
        if (!changed) {
          return "Didn't get notice of the setting change";
        }
      })
      .end(done);
  });
});

var prefixes = ['/', '/db/'];

prefixes.forEach(function (prefix) {
  describe('basics for ' + prefix, function () {
    it('GET / should respond with a welcome page', function (done) {
      var app = express();
      app.use(prefix, expressApp);

      testWelcome(app, done, prefix);
    });
    it('GET / should respond with adapters', function () {
      var app = express();
      app.use(prefix, expressApp);
      return request(app).get(prefix).expect(200).then(function (res) {
        var json = JSON.parse(res.text);
        assert.deepEqual(json['pouchdb-adapters'], ['leveldb']);
      });
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

describe('modes', function () {
  it('should always return a 404 in our custom configuration', function (done) {
    request(customApp)
      .get('/')
      .expect(404)
      .expect(function (res) {
        if (JSON.parse(res.text).error !== 'not_found') {
          return 'Wrong response body';
        }
      })
      .end(done);
  });
  it('should generate a functioning core app', function (done) {
    testWelcome(coreApp, done, '/');
  });
  it('should throw an error when given an invalid mode', function () {
    assertException(function () {
      buildApp(PouchDB, { mode: 'unexisting-mode' });
    }, /Unknown mode: unexisting-mode/);
  });
  it('should throw an error when a not included part is excluded', function () {
    assertException(function () {
      buildApp(PouchDB, { overrideMode: { exclude: ['abc'] } });
    }, /exclude contains the not included part 'abc'/);
  });
  it('should throw an error when an unknown part is included', function () {
    assertException(function () {
      buildApp(PouchDB, { overrideMode: { include: ['abc'] } });
    }, /include contains the unknown part 'abc'/);
  });
});

describe('redirects', function () {
  it('GET /_utils should redirect to /_utils/', function (done) {
    request(coreApp).get('/_utils').expect(301).end(done);
  });
  it('GET /_utils/ should return fauxton', function (done) {
    request(coreApp)
      .get('/_utils/')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /<title>PouchDB Server<\/title>/.test(res.text),
          "No '<title>PouchDB Server</title>' in response"
        );
      })
      .end(done);
  });
});

var created, destroyed;

var destroyedListener = function (name) {
  destroyed.push(name);
  // console.log('destroyed: ' + destroyed.length, name);
};

var createdListener = function (name) {
  created.push(name);
  // console.log('created: ' + created.length, name);
};

describe('own pouch', function () {
  this.timeout(LARGE_TIMEOUT);
  var error, out = '';

  // restore process.stdout.write() and console.log() to their previous glory
  var cleanup = function () {
    process.nextTick(function () {
      // console.log('cleanup!', out);
      // process.stdout.write = write;
      // console.log = log;
      console.error = error;
      // console.warn = warn;
      out = '';
    });
  };

  beforeEach(function () {
    // store these functions to restore later because we are messing with them
    // write = process.stdout.write;
    // log = console.log;
    error = console.error;
    // warn = console.warn;

    // our stub will concatenate any output to a string
    //process.stdout.write = console.log =
    //console.warn =
    console.error = function (s) {
      out += s;
    };

    // do the same for console.error
    // process.stderr.write = console.error = function (s) {
    //   err += s;
    // };
  });

  // restore after each test
  afterEach(cleanup);

  it('should wrap own pouch', function (done) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
        //   return "No '<title>PouchDB Server</title>' in response";
        // }
      })
      .end(done);
  });

  it('should wrap own pouch without emitter leak', function (done) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        assert.equal(false, /EventEmitter memory leak/.test(out), 'Got emitter leak error: ' + out);
        done();
      })
      .catch(done);
  });

  it('should wrap own pouch without conflict update on stdout', function (done) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        done();
      })
      .catch(done);
  });

  it('should wrap in memory own pouch without conflict update on stdout', function (done) {
    var app = express();
    var InMemPouchDB = PouchDB.defaults({
      db: memdown
    });

    app.use('/', buildApp(InMemPouchDB));

    new InMemPouchDB('foo');

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        InMemPouchDB.allDbs(function (err, dbs) {
          console.log('all.dbs', dbs);
        });
      })
      .then(function () {
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        done();
      })
      .catch(done);
  });

  it('should wrap own pouch and emit the expected events given the daemon manager', function (done) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');

    created = [];
    PouchDB.on('created', createdListener);

    destroyed = [];
    PouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        assert.equal(
          true,
          created.includes('foo', '_replicator', '_users', 'pouch__all_dbs__'),
          'Missing created databases.'
        );
        assert.equal(
          5,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done();
      })
      .catch(function () {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done();
      });
  });

  it('should wrap own in memory pouch and emit the expected events given the daemon manager', function (
    done
  ) {
    var app = express();
    var InMemPouchDB = PouchDB.defaults({
      db: memdown
    });

    app.use('/', buildApp(InMemPouchDB));

    new InMemPouchDB('foo');

    created = [];
    InMemPouchDB.on('created', createdListener);

    destroyed = [];
    InMemPouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        assert.equal(
          true,
          created.includes('foo', '_replicator', '_users', 'pouch__all_dbs__'),
          'Missing created databases.'
        );
        assert.equal(
          5,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        InMemPouchDB.allDbs(function (err, dbs) {
          console.log('all.dbs', dbs);
        });
      })
      .then(function () {
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        InMemPouchDB.removeListener('created', createdListener);
        InMemPouchDB.removeListener('destroyed', destroyedListener);
        done();
      })
      .catch(function () {
        InMemPouchDB.removeListener('created', createdListener);
        InMemPouchDB.removeListener('destroyed', destroyedListener);
        done();
      });
  });

  it('should wrap own pouch a second time and emit the expected events given the deamon manager', function (
    done
  ) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');

    created = [];
    PouchDB.on('created', createdListener);

    destroyed = [];
    PouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .expect(function () {
        assert.equal(
          true,
          created.includes('foo', '_replicator', '_users', 'pouch__all_dbs__'),
          'Missing created databases.'
        );
        assert.equal(
          5,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        done();
      })
      .catch(function (err) {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
  });

  it('should wrap multiple own pouch and not emit a conflict update on stdout', function (done) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo');
    new PouchDB('bar');

    created = [];
    PouchDB.on('created', createdListener);

    destroyed = [];
    PouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .then(function () {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        assert.equal(false, /conflict/.test(out), 'Got conflict update error: ' + out);
        done();
      })
      .catch(function (err) {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
  });

  it('should wrap multiple own pouch and emit the expected events given the deamon manager', function (
    done
  ) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    new PouchDB('foo', {
      db: memdown
    });

    new PouchDB('bar', {
      db: memdown
    });

    created = [];
    PouchDB.on('created', createdListener);

    destroyed = [];
    PouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .expect(function () {
        assert.equal(true, created.includes('foo'), 'Missing created databases.');
        assert.equal(
          6,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done();
      })
      .catch(function (err) {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
  });

  it('should wrap multiple inmem own pouch and emit the expected events given the deamon manager', function (
    done
  ) {
    var app = express();
    var InMemPouchDB = PouchDB.defaults({
      db: memdown
    });
    app.use('/', buildApp(InMemPouchDB));

    new InMemPouchDB('foo');
    new InMemPouchDB('bar');

    created = [];
    InMemPouchDB.on('created', createdListener);

    destroyed = [];
    InMemPouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .expect(function () {
        assert.equal(true, created.includes('foo'), 'Missing created databases.');
        assert.equal(
          6,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        InMemPouchDB.removeListener('created', createdListener);
        InMemPouchDB.removeListener('destroyed', destroyedListener);
        done();
      })
      .then(function () {
        InMemPouchDB.allDbs(function (err, dbs) {
          console.log('all.dbs', dbs);
        });
      })
      .catch(function (err) {
        InMemPouchDB.removeListener('created', createdListener);
        InMemPouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
  });

  it('should wrap multiple own pouch, tear them down and emit the expected events given the deamon manager', function (
    done
  ) {
    var app = express();
    app.use(
      '/',
      buildApp(
        PouchDB.defaults({
          db: memdown
        })
      )
    );

    var myPouch = new PouchDB('foo');
    var myPouch2 = new PouchDB('bar');

    created = [];
    PouchDB.on('created', createdListener);

    destroyed = [];
    PouchDB.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .expect(function () {
        assert.equal(
          true,
          created.includes('foo', 'bar', '_replicator', '_users', 'pouch__all_dbs__'),
          'Missing created databases.'
        );
        assert.equal(
          6,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        myPouch.destroy();
        myPouch2.destroy();
        return Promise.delay(100);
      })
      .then(function () {
        assert.equal(
          2,
          destroyed.length,
          'Number of expected destroyed databases is wrong. Databases destroyed are: ' + destroyed
        );
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done();
      })
      .catch(function (err) {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
  });

  it('should wrap multiple own pouch, tear them down and recreate with the expected outcome', function (
    done
  ) {
    var app = express();
    var InMemPouchDb = PouchDB.defaults({
      db: memdown
    });
    app.use('/', buildApp(InMemPouchDb));

    var myPouch = new PouchDB('foo');
    var myPouch2 = new PouchDB('bar');

    created = [];
    InMemPouchDb.on('created', createdListener);

    destroyed = [];
    InMemPouchDb.on('destroyed', destroyedListener);

    request(app)
      .get('/foo')
      .expect(200)
      .expect(function (res) {
        assert.equal(
          true,
          /\"db_name\":\"foo\"/.test(res.text),
          'No \'"db_name": "foo"\' in response'
        );
        // console.log(res.text);
        if (!/<titl>PouchDB Server<\/title>/.test(res.text)) {
          return "No '<title>PouchDB Server</title>' in response";
        }
      })
      .expect(function () {
        assert.equal(true, created.includes('foo'), 'Missing created databases.');
        assert.equal(true, created.includes('bar'), 'Missing created databases.');
        assert.equal(
          6,
          created.length,
          'Number of expected created databases is wrong. Databases created are: ' + created
        );
      })
      .then(function () {
        myPouch.destroy();
        myPouch2.destroy();
        return Promise.delay(100);
      })
      .then(function () {
        assert.equal(
          2,
          destroyed.length,
          'Number of expected destroyed databases is wrong. Databases destroyed are: ' + destroyed
        );
      })
      .then(function () {
        new InMemPouchDb('newfoo');
        return Promise.delay(1000);
      })
      .then(function () {
        assert.equal(true, created.includes('newfoo'), 'Missing created databases newFoo');
        done();
      })
      .then(function () {
        InMemPouchDb.allDbs(function (err, dbs) {
          console.log('all.dbs', dbs);
        });
      })
      .catch(function (err) {
        PouchDB.removeListener('created', createdListener);
        PouchDB.removeListener('destroyed', destroyedListener);
        done(err);
      });
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
  throw e || new Error('no error was thrown');
}
