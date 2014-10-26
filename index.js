var startTime        = new Date().getTime()
  , express          = require('express')
  , jsonParser       = require('body-parser').json({limit: '1mb'})
  , urlencodedParser = require('body-parser').urlencoded({extended: false})
  , rawBody          = require('raw-body')
  , cookieParser     = require('cookie-parser')
  , fs               = require('fs')
  , path             = require('path')
  , extend           = require('extend')
  , pkg              = require('./package.json')
  , multiparty       = require('multiparty')
  , Promise          = require('bluebird')
  , basicAuth        = require('basic-auth')
  , dbs              = {}
  , uuids            = require('./uuids')
  , histories        = {}
  , app              = express()
  , CouchConfig      = require('./lib/couch_config')
  , events           = require('events')
  , Security         = require('pouchdb-security');

var PouchDB, usersDB, preparingUsersDB, usersDBName, replicatorDB, preparingReplicatorDB, replicatorDBName;

module.exports = function(PouchToUse) {
  PouchDB = PouchToUse;
  require('pouchdb-all-dbs')(PouchDB);
  PouchDB.plugin(require('pouchdb-rewrite'));
  PouchDB.plugin(require('pouchdb-list'));
  PouchDB.plugin(Security)
  PouchDB.plugin(require('pouchdb-show'));
  PouchDB.plugin(require('pouchdb-update'));
  PouchDB.plugin(require('pouchdb-validation'));
  PouchDB.plugin(require('pouchdb-auth'));
  PouchDB.plugin(require('pouchdb-replicator'));

  Security.installStaticSecurityMethods(PouchDB);

  // init DbUpdates
  app.couch_db_updates = new events.EventEmitter();

  PouchDB.on('created', function (dbName) {
    app.couch_db_updates.emit('update', {db_name: dbName, type: 'created'});
  });

  PouchDB.on('destroyed', function (dbName) {
    app.couch_db_updates.emit('update', {db_name: dbName, type: 'deleted'});
  });

  app.couchConfig = new CouchConfig('./config.json');

  ensureUsersDB();
  app.couchConfig.on('couch_httpd_auth.authentication_db', ensureUsersDB);

  ensureReplicatorDB();
  app.couchConfig.on('replicator.db', ensureReplicatorDB)

  return app;
};

//There are four types of databases:
//- unwrapped databases. These are what you get by doing new PouchDB()
//
//- normal databases. These are validated and you need proper authorisation
//  to use them. Related: useAsNormalDB()/stopUsingAsNormalDB
//
//- replicator databases. Better known as _replicator. Related:
//  db.startReplicator()/.stopReplicator()
//
//- user databases. Better known as _users. Related:
//  db.useAsAuthenticationDB()/.stopUsingAsAuthenticationDB()

function ensureUsersDB() {
  var name = app.couchConfig.get('couch_httpd_auth', 'authentication_db');

  function wrap(db) {
    return db.useAsAuthenticationDB();
  }
  function unwrap(db) {
    return db.stopUsingAsAuthenticationDB();
  }

  preparingUsersDB = (preparingUsersDB || Promise.resolve()).then(function () {
    return ensureSpecialDB(wrap, unwrap, usersDB, name);
  }).then(function (db) {
    usersDBName = name;
    usersDB = db;
  });
}

function ensureReplicatorDB() {
  var name = app.couchConfig.get('replicator', 'db');

  function wrap(db) {
    return db.startReplicator();
  }
  function unwrap(db) {
    return db.stopReplicator();
  }

  preparingReplicatorDB = (preparingReplicatorDB || Promise.resolve()).then(function () {
    return ensureSpecialDB(wrap, unwrap, replicatorDB, name);
  }).then(function (db) {
    replicatorDBName = name;
    replicatorDB = db;
  });
}

function ensureSpecialDB(specialWrap, specialUnwrap, oldDB, newName) {
  function cleanupSuccess() {
    useAsNormalDB(oldDB);
    return cleanupDone();
  }
  function cleanupDone() {
    var newDB = getUnwrappedDB(newName);
    return specialWrap(newDB).then(function () {
      dbs[newName] = newDB;
      return newDB;
    });
  }

  if (typeof oldDB === "undefined") {
    return cleanupDone();
  } else {
    return specialUnwrap(oldDB).then(cleanupSuccess, cleanupDone);
  }
}

function getUnwrappedDB(name) {
  db = dbs[name];
  if (typeof db === "undefined") {
    db = new PouchDB(name);
  } else {
    stopUsingAsNormalDB(db);
  }
  return db;
}

function authFunc(name) {
  return function () {
    var args = arguments;
    return preparingUsersDB.then(function () {
      return usersDB[name].apply(usersDB, args);
    });
  }
}

var session = authFunc("session"),
    logIn   = authFunc("logIn"),
    logOut  = authFunc("logOut");

function makeOpts(req, startOpts) {
  // fill in opts so it can be used by authorisation logic
  var opts = startOpts || {};
  opts.userCtx = req.couchSession.userCtx;
  opts.secObj = req.couchSessionObj;

  return opts;
}

function registerDB(name, db) {
  useAsNormalDB(db);
  dbs[name] = db;
}

function useAsNormalDB(db) {
  // order matters!
  db.installSecurityMethods();
  db.installValidationMethods();
}

function stopUsingAsNormalDB(db) {
  // order doesn't matter!
  db.uninstallValidationMethods();
  db.uninstallSecurityMethods();
}

function setDBOnReq(db_name, req, res, next) {
  var name = encodeURIComponent(db_name);

  function doneSettingDB() {
    req.db.getSecurity().then(function (secObj) {
      req.couchSessionObj = secObj;

      next();
    });
  }

  if (name in dbs) {
    req.db = dbs[name];
    return doneSettingDB();
  }

  PouchDB.allDbs(function (err, dbs) {
    if (err) {
      return sendError(res, err);
    } else if (dbs.indexOf(name) === -1) {
      return sendJSON(res, 404, {
        error: 'not_found',
        reason: 'no_db_file'
      });
    }
    new PouchDB(name, function (err, db) {
      if (err) return sendError(res, err, 412);
      registerDB(name, db);
      req.db = db;
      return doneSettingDB();
    });
  });
}

function expressReqToCouchDBReq(req) {
  return makeOpts(req, {
    body: req.body ? JSON.stringify(req.body) : "undefined",
    cookie: req.cookies || {},
    headers: req.headers,
    method: req.method,
    peer: req.ip,
    query: req.query
  });
}

function sendCouchDBResp(res, err, couchResp) {
  if (err) return sendError(res, err);

  res.set(couchResp.headers);
  var body;
  if (couchResp.base64) {
    body = new Buffer(couchResp.base64, 'base64');
  } else {
    body = couchResp.body;
  }
  res.status(couchResp.code).send(body);
}

function buildCookieSession(req) {
  var opts = {
    sessionID: (req.cookies || {}).AuthSession,
    admins: app.couchConfig.getSection("admins")
  };
  if (!opts.sessionID) {
    throw new Error("No cookie, so no cookie auth.");
  }
  return session(opts).then(function (result) {
    if (result.info.authenticated) {
      result.info.authenticated = 'cookie';
    }
    return result;
  });
}

function buildBasicAuthSession(req) {
  var userInfo = basicAuth(req);
  var opts = {
    sessionID: uuids(1)[0],
    admins: app.couchConfig.getSection("admins")
  }
  var initializingDone = Promise.resolve();
  if (userInfo) {
    initializingDone = initializingDone.then(function () {
      return logIn(userInfo.name, userInfo.pass, opts);
    });
  }
  var result;
  return initializingDone.then(function () {
    return session(opts);
  }).then(function (theSession) {
    result = theSession;

    // Cleanup
    return logOut(opts);
  }).then(function () {
    if (result.info.authenticated) {
      result.info.authenticated = 'default';
    }
    return result;
  });
}

app.use(require('compression')());

app.use('/js', express.static(__dirname + '/fauxton/js'));
app.use('/css', express.static(__dirname + '/fauxton/css'));
app.use('/img', express.static(__dirname + '/fauxton/img'));
app.use('/fonts', express.static(__dirname + '/fauxton/fonts'));

app.use(cookieParser());

app.use(function (req, res, next) {
  var opts = {}
    , data = ''
    , prop;

  // Normalize query string parameters for direct passing
  // into PouchDB queries.
  for (prop in req.query) {
    try {
      req.query[prop] = JSON.parse(req.query[prop]);
    } catch (e) {}
  }
  next();
});

function sendError(res, err, baseStatus) {
  var status = err.status || baseStatus || 500;

  // last argument is optional
  if (err.name && err.message) {
    if (err.name === 'Error') {
      if (err.message.indexOf("Bad special document member") !== -1) {
        err.name = 'doc_validation';
      }
      // add more clauses here if the error name is too general
    }
    err = {
      error: err.name,
      reason: err.message
    };
  }
  sendJSON(res, status, err);
}

function sendJSON(res, status, body) {
  res.status(status);

  var type = res.req.accepts(['text', 'json']);
  if (type === "json") {
    res.setHeader('Content-Type', 'application/json');
  } else {
    //adds ; charset=utf-8
    res.type('text/plain');
  }
  //convert to buffer so express doesn't add the ; charset=utf-8 if it
  //isn't already there by now. No performance problem: express does
  //this internally anyway.
  res.send(new Buffer(JSON.stringify(body) + "\n", 'utf8'));
}

function setLocation(res, path) {
  //CouchDB location headers are always non-relative.
  var loc = res.req.protocol
    + '://'
    + ((res.req.hostname === '127.0.0.1') ? '' : res.req.subdomains.join('.') + '.')
    + res.req.hostname
    + ':' + res.req.socket.localPort
    + '/' + path;
  res.location(loc);
}

app.use(function (req, res, next) {
  // TODO: TIMING ATTACK
  Promise.resolve().then(function () {
    return buildCookieSession(req)
  }).catch(function (err) {
    return buildBasicAuthSession(req);
  }).then(function (result) {
    req.couchSession = result;
    req.couchSession.info.authentication_handlers = ['cookie', 'default'];
    next();
  }).catch(function (err) {
    sendError(res, err);
  });
});

// Query design document rewrite handler
app.use(function (req, res, next) {
  // Prefers regex over setting the first argument of app.use(), because
  // the last makes req.url relative, which in turn makes most rewrites
  // impossible.
  var match = /\/([^\/]*)\/_design\/([^\/]*)\/_rewrite\/([^?]*)/.exec(req.url);
  if (!match) {
    return next();
  }
  setDBOnReq(match[1], req, res, function () {
    var query = match[2] + "/" + match[3];
    var opts = expressReqToCouchDBReq(req);
    req.db.rewriteResultRequestObject(query, opts, function (err, resp) {
      if (err) return sendError(res, err);

      req.rawBody = resp.body;
      req.cookies = resp.cookie;
      req.headers = resp.headers;
      req.method = resp.method;
      req.ip = resp.peer;
      req.url = "/" + resp.path.join("/");
      req.query = resp.query;

      console.log("Rewritten to: " + req.url);
      // Handle the newly generated request.
      next();
    });
  });
});

// Root route, return welcome message
app.get('/', function (req, res, next) {
  sendJSON(res, 200, {
    'express-pouchdb': 'Welcome!',
    'version': pkg.version
  });
});

app.get('/_session', function (req, res, next) {
  sendJSON(res, 200, req.couchSession);
});

app.post('/_session', jsonParser, urlencodedParser, function (req, res, next) {
  var name = req.body.name;
  var password = req.body.password;
  var opts = {
    sessionID: uuids(1)[0],
    admins: app.couchConfig.getSection("admins")
  };
  logIn(name, password, opts, function (err, resp) {
    if (err) return sendError(res, err);

    res.cookie('AuthSession', opts.sessionID, {httpOnly: true});
    sendJSON(res, 200, resp);
  });
});

app.delete('/_session', function (req, res, next) {
  var sessionID = (req.cookies || {}).AuthSession;
  logOut({sessionID: sessionID}, function (err, resp) {
    // ``err`` just doesn't occur
    res.clearCookie('AuthSession');
    sendJSON(res, 200, resp);
  });
});


app.all('/_db_updates', requiresServerAdmin, function (req, res, next) {
  // TODO: implement
  res.status(400).end();
  // app.couch_db_updates.on('update', function(update) {
  //   sendJSON(res, 200, update);
  // });
});

app.get('/_utils', function (req, res, next) {
  res.sendfile(__dirname + '/fauxton/index.html');
});

function requiresServerAdmin(req, res, next) {
  if (req.couchSession.userCtx.roles.indexOf('_admin') !== -1) {
    return next();
  }
  sendJSON(res, 401, {
    error: "unauthorized",
    reason:"You are not a server admin."
  });
}

// Config
app.get('/_config', requiresServerAdmin, function (req, res, next) {
  sendJSON(res, 200, app.couchConfig.getAll());
});

app.get('/_config/:section', requiresServerAdmin, function (req, res, next) {
  sendJSON(res, 200, app.couchConfig.getSection(req.params.section));
});

app.get('/_config/:section/:key', requiresServerAdmin, function (req, res, next) {
  var value = app.couchConfig.get(req.params.section, req.params.key);
  sendConfigValue(res, value);
});

function sendConfigValue(res, value) {
  if (typeof value === "undefined") {
    return sendJSON(res, 404, {
      error: "not_found",
      reason: "unknown_config_value"
    });
  }
  sendJSON(res, 200, value);
}

app.put('/_config/:section/:key', requiresServerAdmin, parseRawBody, function (req, res, next) {
  // Custom JSON parsing, because the default JSON body parser
  // middleware only supports JSON lists and objects. (Not numbers etc.)
  var value;
  try {
    value = JSON.parse(req.rawBody.toString('utf-8'));
  } catch (err) {
    return sendJSON(res, 400, {
      error: "bad_request",
      reason: "invalid_json"
    });
  }
  if (typeof value !== "string") {
    value = JSON.stringify(value);
  }

  app.couchConfig.set(req.params.section, req.params.key, value, function (err, oldValue) {
    sendJSON(res, 200, oldValue || "");
  });
});

app.delete('/_config/:section/:key', requiresServerAdmin, function (req, res, next) {
  app.couchConfig.delete(req.params.section, req.params.key, function (err, oldValue) {
    sendConfigValue(res, oldValue);
  });
});

// Log (stub for now)
app.get('/_log', requiresServerAdmin, function (req, res, next) {
  // TODO: implement
  sendJSON(res, 200, '_log is not implemented yet. PRs welcome!');
});

// Log (stub for now)
app.get('/_stats', function (req, res, next) {
  // TODO: implement
  sendJSON(res, 200, {'pouchdb-server' : 'has not impemented _stats yet. PRs welcome!'});
});

app.get('/_active_tasks', requiresServerAdmin, function (req, res, next) {
  // TODO: implement
  sendJSON(res, 200, []);
});

// Generate UUIDs
app.all('/_uuids', restrictMethods(["GET"]), function (req, res, next) {
  res.set({
    "Cache-Control": "must-revalidate, no-cache",
    "Pragma": "no-cache"
  });
  var count = typeof req.query.count === 'number' ? req.query.count : 1;
  sendJSON(res, 200, {
    uuids: uuids(count)
  });
});

function restrictMethods(methods) {
  return function (req, res, next) {
    if (methods.indexOf(req.method) === -1) {
      res.set("Allow", methods.join(", "));
      return sendJSON(res, 405, {
        error: 'method_not_allowed',
        reason: "Only " + methods.join(",") + " allowed"
      });
    }
    next();
  };
}

// List all databases.
app.get('/_all_dbs', function (req, res, next) {
  PouchDB.allDbs(function (err, response) {
    if (err) {
      sendJSON(res, 500, {
        error: "unknown_error",
        reason: "Database encountered an unknown error"
      });
    }

    response = response.filter(function (name) {
      return name.indexOf("-session-") !== 0;
    });
    sendJSON(res, 200, response);
  });
});

// Replicate a database
app.post('/_replicate', jsonParser, function (req, res, next) {

  var source = req.body.source
    , target = req.body.target
    , opts = makeOpts(req, {continuous: !!req.body.continuous});

  if (req.body.filter) opts.filter = req.body.filter;
  if (req.body.query_params) opts.query_params = req.body.query_params;

  var startDate = new Date();
  PouchDB.replicate(source, target, opts).then(function (response) {
    
    var historyObj = extend(true, {
      start_time: startDate.toJSON(),
      end_time: new Date().toJSON()
    }, response);
    
    var currentHistories = [];
    
    if (!/^https?:\/\//.test(source)) {
      histories[source] = histories[source] || [];
      currentHistories.push(histories[source]);

    }
    if (!/^https?:\/\//.test(target)) {
      histories[target] = histories[target] || [];
      currentHistories.push(histories[target]);
    }
    
    currentHistories.forEach(function (history) {
      // CouchDB caps history at 50 according to
      // http://guide.couchdb.org/draft/replication.html
      history.push(historyObj);
      if (history.length > 50) {
        history.splice(0, 1); // TODO: this is slow, use a stack instead
      }      
    });
    
    response.history = histories[source] || histories[target] || [];
    sendJSON(res, 200, response);
  }, function (err) {
    sendError(res, err);
  });

  // if continuous pull replication return 'ok' since we cannot wait for callback
  if (target in dbs && opts.continuous) {
    sendJSON(res, 200, { ok : true });
  }

});

// Create a database.
app.put('/:db', jsonParser, function (req, res, next) {
  var name = encodeURIComponent(req.params.db);

  if (name in dbs) {
    return sendJSON(res, 412, {
      'error': 'file_exists',
      'reason': 'The database could not be created.'
    });
  }

  // PouchDB.new() instead of new PouchDB() because that adds
  // authorisation logic
  PouchDB.new(name, makeOpts(req), function (err, db) {
    if (err) return sendError(res, err, 412);
    registerDB(name, db);
    setLocation(res, name);
    sendJSON(res, 201, { ok: true });
  });
});

// Delete a database
app.delete('/:db', function (req, res, next) {
  var name = encodeURIComponent(req.params.db);
  PouchDB.destroy(name, makeOpts(req), function (err, info) {
    if (err) return sendError(res, err);
    delete dbs[name];
    //if one of these was removed, it should re-appear.
    if (usersDBName === name) ensureUsersDB();
    if (replicatorDBName === name) ensureReplicatorDB();
    sendJSON(res, 200, { ok: true });
  });
});

// At this point, some route middleware can take care of identifying the
// correct PouchDB instance.
['/:db/*','/:db'].forEach(function (route) {
  app.all(route, function (req, res, next) {
    setDBOnReq(req.params.db, req, res, next);
  });
});

// Get database information
app.get('/:db', function (req, res, next) {
  req.db.info(makeOpts(req), function (err, info) {
    if (err) return sendError(res, err);
    info.instance_start_time = startTime.toString();
    // TODO: disk_size
    // TODO: data_size
    sendJSON(res, 200, info);
  });
});

// Bulk docs operations
app.post('/:db/_bulk_docs', jsonParser, function (req, res, next) {

  // Maybe this should be moved into the leveldb adapter itself? Not sure
  // how uncommon it is for important options to come through in the body
  // https://github.com/daleharvey/pouchdb/issues/435
  var opts = 'new_edits' in req.body
    ? { new_edits: req.body.new_edits }
    : {};
  opts = makeOpts(req, opts);

  if (Array.isArray(req.body)) {
    return sendJSON(res, 400, {
      error: "bad_request",
      reason: "Request body must be a JSON object"
    });
  }

  req.db.bulkDocs(req.body, opts, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 201, response);
  });

});

// Ensure all commits are written to disk
app.post('/:db/_ensure_full_commit', function (req, res, next) {
  // TODO: implement. Also check security then: who is allowed to access this? (db & server admins?)
  sendJSON(res, 201, {
    ok: true, 
    instance_start_time: startTime.toString()
  });
});

// All docs operations
app.all('/:db/_all_docs', jsonParser, function (req, res, next) {
  if (req.method !== 'GET' && req.method !== 'POST') return next();

  // Check that the request body, if present, is an object.
  if (!!req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return sendJSON(res, 400, {
      reason: "Something wrong with the request",
      error: 'bad_request'
    });
  }

  var opts = makeOpts(req, extend({}, req.body, req.query));
  req.db.allDocs(opts, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 200, response);
  });

});

// Monitor database changes
app.get('/:db/_changes', function (req, res, next) {

  // api.changes expects a property `query_params`
  // This is a pretty inefficient way to do it.. Revisit?
  req.query.query_params = JSON.parse(JSON.stringify(req.query));

  req.query = makeOpts(req, req.query);

  if (req.query.feed === 'continuous' || req.query.feed === 'longpoll') {
    var heartbeatInterval;
    // 60000 is the CouchDB default
    // TODO: figure out if we can make this default less aggressive
    var heartbeat = (typeof req.query.heartbeat === 'number') ? req.query.heartbeat : 6000;
    var written = false;
    heartbeatInterval = setInterval(function () {
      written = true;
      res.write('\n');
    }, heartbeat);

    var cleanup = function () {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };

    if (req.query.feed === 'continuous') {
      req.query.live = req.query.continuous = true;
      req.db.changes(req.query).on('change', function (change) {
        written = true;
        res.write(JSON.stringify(change) + '\n');
      }).on('error', function (err) {
        if (!written) {
          sendError(res, err);
        } else {
          res.end();
        }
        cleanup();
      });
    } else { // longpoll

      // first check if there are >0. if so, return them immediately
      req.query.live = req.query.continuous = false;
      req.db.changes(req.query).on('complete', function (complete) {
        if (!complete.results) {
          // canceled, ignore
          cleanup();
        } else if (complete.results.length) {
          written = true;
          res.write(JSON.stringify(complete) + '\n');
          res.end();
          cleanup();
        } else { // do the longpolling
          req.query.live = req.query.continuous = true;
          var changes = req.db.changes(req.query).on('change', function (change) {
            written = true;
            res.write(JSON.stringify({results: [change], last_seq: change.seq}) + '\n');
            res.end();
            changes.cancel();
            cleanup();
          }).on('error', function (err) {
            if (!written) {
              sendError(res, err);
            }
            cleanup();
          });
        }
      }).on('error', function (err) {
        if (!written) {
          sendError(res, err);
        }
        cleanup();
      });
    }
  } else { // straight shot, not continuous
    req.query.complete = function (err, response) {
      if (err) return sendError(res, err);
      sendJSON(res, 200, response);
    };
    req.db.changes(req.query);
  }
});

// DB Compaction
app.post('/:db/_compact', jsonParser, function (req, res, next) {
  req.db.compact(makeOpts(req), function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 200, {ok: true});
  });
});

// Revs Diff
app.post('/:db/_revs_diff', jsonParser, function (req, res, next) {
  req.db.revsDiff(req.body || {}, makeOpts(req), function (err, diffs) {
    if (err) return sendJSON(res, err);

    sendJSON(res, 200, diffs);
  });
});

// Security
app.get('/:db/_security', function (req, res, next) {
  req.db.getSecurity(makeOpts(req), function (err, response) {
    if (err) return sendError(res, err);

    sendJSON(res, 200, response);
  });
});

app.put('/:db/_security', jsonParser, function (req, res, next) {
  req.db.putSecurity(req.body || {}, makeOpts(req), function (err, response) {
    if (err) return sendError(res, err);

    sendJSON(res, 200, response);
  });
});

// Temp Views
app.post('/:db/_temp_view', jsonParser, function (req, res, next) {
  if (req.body.map) req.body.map = (new Function('return ' + req.body.map))();
  req.query.conflicts = true;
  var opts = makeOpts(req, req.query);
  req.db.query(req.body, opts, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 200, response);
  });
});

// Query design document info
app.get('/:db/_design/:id/_info', function (req, res, next) {
  // Dummy data for Fauxton - when implementing fully also take into
  // account req.couchSessionObj - this needs at least db view rights it
  // seems.
  sendJSON(res, 200, {
    'name': req.query.id,
    'view_index': 'Not implemented.'
  });
});

// Query a document view
app.get('/:db/_design/:id/_view/:view', function (req, res, next) {
  var query = req.params.id + '/' + req.params.view;
  var opts = makeOpts(req, req.query);
  req.db.query(query, opts, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 200, response);
  });
});

// Query design document list handler
app.all('/:db/_design/:id/_list/:func/:view', jsonParser, function (req, res, next) {
  var query = [req.params.id, req.params.func, req.params.view].join("/");
  var opts = expressReqToCouchDBReq(req);
  req.db.list(query, opts, sendCouchDBResp.bind(null, res));
});

// Query design document show handler
app.all('/:db/_design/:id/_show/:func/:docid?', jsonParser, function (req, res, next) {
  var query = [req.params.id, req.params.func, req.params.docid].join("/");
  var opts = expressReqToCouchDBReq(req);
  req.db.show(query, opts, sendCouchDBResp.bind(null, res));
});

// Query design document update handler
app.all('/:db/_design/:id/_update/:func/:docid?', jsonParser, function (req, res, next) {
  var query = [req.params.id, req.params.func, req.params.docid].join("/");
  var opts = expressReqToCouchDBReq(req);
  req.db.update(query, opts, sendCouchDBResp.bind(null, res));
});

function parseRawBody(req, res, next) {
  // Custom bodyParsing because bodyParser chokes
  // on 'malformed' requests, and also because we need the
  // rawBody for attachments
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  rawBody(req, {
    length: req.headers['content-length']
  }, function (err, string) {
    if (err) {
      return next(err)
    }
    req.rawBody = string
    next()
  });
}

// Put a document attachment
function putAttachment(db, name, req, res) {
  var attachment = req.params.attachment
    , rev = req.query.rev
    , type = req.get('Content-Type') || 'application/octet-stream'
    , body = new Buffer(req.rawBody || '', 'binary')
    , opts = makeOpts(req);

  req.db.putAttachment(name, attachment, rev, body, type, opts, function (err, response) {
    if (err) return sendError(res, err);
    setLocation(res, db + '/' + name + '/' + attachment);
    sendJSON(res, 201, response);
  });    
}

app.put('/:db/_design/:id/:attachment(*)', parseRawBody, function (req, res, next) {
  putAttachment(req.params.db, '_design/' + req.params.id, req, res);
});

app.put('/:db/:id/:attachment(*)', parseRawBody, function (req, res, next) {
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  putAttachment(req.params.db, req.params.id, req, res);
});

// Retrieve a document attachment
function getAttachment(name, req, res) {
  var attachment = req.params.attachment;
  var opts = makeOpts(req, req.query);

  req.db.get(name, opts, function (err, info) {
    if (err) return sendError(res, err);

    if (!info._attachments || !info._attachments[attachment]) {
      return sendJSON(res, 404, {
        error:'not_found',
        reason:'missing'
      });
    };

    var type = info._attachments[attachment].content_type;
    var md5 = info._attachments[attachment].digest.slice(4);

    req.db.getAttachment(name, attachment, function (err, response) {
      if (err) return sendError(res, err);
      res.set('ETag', '"' + md5 + '"');
      res.setHeader('Content-Type', type);
      res.status(200).send(response);
    });
  });
}

app.get('/:db/_design/:id/:attachment(*)', function (req, res, next) {
  getAttachment('_design/' + req.params.id, req, res);
});

app.get('/:db/:id/:attachment(*)', function (req, res, next) {
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  getAttachment(req.params.id, req, res);
});

// Delete a document attachment
function deleteAttachment(name, req, res) {
  var name = req.params.id
    , attachment = req.params.attachment
    , rev = req.query.rev
    , opts = makeOpts(req);

  req.db.removeAttachment(name, attachment, rev, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 200, response);
  });
}

app.delete('/:db/_design/:id/:attachment(*)', function (req, res, next) {
  deleteAttachment('_design/' + req.params.id, req, res);
});

app.delete('/:db/:id/:attachment(*)', function (req, res, next) {
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  deleteAttachment(req.params.id, req, res);
});

// Create or update document that has an ID
app.put('/:db/:id(*)', jsonParser, function (req, res, next) {

  var opts = makeOpts(req, req.query);

  function onResponse(err, response) {
    if (err) return sendError(res, err);
    res.set('ETag', '"' + response.rev + '"');
    setLocation(res, req.params.db + '/' + response.id);
    sendJSON(res, 201, response);
  }

  if (/^multipart\/related/.test(req.headers['content-type'])) {
    // multipart, assuming it's also new_edits=false for now
    var doc;
    var promise = Promise.resolve();
    var form = new multiparty.Form();
    var attachments = {};
    form.on('error', function (err) {
      return sendError(res, err);
    }).on('field', function (_, field) {
      doc = JSON.parse(field);
    }).on('file', function (_, file) {
      var type = file.headers['content-type'];
      var filename = file.originalFilename;
      promise = promise.then(function () {
        return Promise.promisify(fs.readFile)(file.path);
      }).then(function (body) {
        attachments[filename] = {
          content_type: type,
          data: body
        };
      });
    }).on('close', function () {
      promise.then(function () {
        // merge, since it could be a mix of stubs and non-stubs
        doc._attachments = extend(true, doc._attachments, attachments);
        req.db.put(doc, opts, onResponse);
      }).catch(function (err) {
        sendError(res, err);
      });
    });
    form.parse(req);
  } else {
    // normal PUT
    req.body._id = req.body._id || req.query.id;
    if (!req.body._id) {
      req.body._id = (!!req.params.id && req.params.id !== 'null')
        ? req.params.id
        : null;
    }
    req.body._rev = getRev(req, req.body);
    req.db.put(req.body, opts, onResponse);
  }
});

function getRev(req, doc) {
  var docRevExists = typeof doc._rev !== 'undefined';
  var queryRevExists = typeof req.query.rev !== 'undefined';
  var etagRevExists = typeof req.get('If-Match') !== 'undefined';
  if (docRevExists && queryRevExists && doc._rev !== req.query.rev) {
    return sendJSON(res, 400, {
      error: 'bad_request',
      reason: "Document rev from request body and query string have different values"
    });
  }
  var etagRev;
  if (etagRevExists) {
    etagRev = req.get('If-Match').slice(1, -1);
    if (docRevExists && doc._rev !== etagRev) {
      return sendJSON(res, 400, {
        error: 'bad_request',
        reason: "Document rev and etag have different values"
      });
    }
    if (queryRevExists && req.query.rev !== etagRev) {
      return sendJSON(res, 400, {
        error: 'bad_request',
        reason: "Document rev and etag have different values"
      });
    }
  }

  return doc._rev || req.query.rev || etagRev;
}

// Create a document
app.post('/:db', jsonParser, function (req, res, next) {
  var opts = makeOpts(req, req.query);

  req.body._id = uuids(1)[0];
  req.db.put(req.body, opts, function (err, response) {
    if (err) return sendError(res, err);
    sendJSON(res, 201, response);
  });
});

// Retrieve a document
app.get('/:db/:id(*)', function (req, res, next) {
  var opts = makeOpts(req, req.query);

  req.db.get(req.params.id, opts, function (err, doc) {
    if (err) return sendError(res, err);

    res.set('ETag', '"' + doc._rev + '"');
    sendJSON(res, 200, doc);
  });
});

// Delete a document
app.delete('/:db/:id(*)', function (req, res, next) {
  var opts = makeOpts(req, req.query);
  opts.rev = getRev(req, {});

  req.db.get(req.params.id, opts, function (err, doc) {
    if (err) return sendError(res, err);
    req.db.remove(doc, opts, function (err, response) {
      if (err) return sendError(res, err);
      sendJSON(res, 200, response);
    });
  });
});

// Copy a document
app.copy('/:db/:id', function (req, res, next) {
  var dest = req.get('Destination')
    , rev
    , match;

  if (!dest) {
    return sendJSON(res, 400, {
      'error': 'bad_request',
      'reason': 'Destination header is mandatory for COPY.'
    });
  }

  if(isHTTP(dest) || isHTTPS(dest)) {
    return sendJSON(res, 400, {
      'error': 'bad_request',
      'reason': 'Destination URL must be relative.'
    });
  }

  if (match = /(.+?)\?rev=(.+)/.exec(dest)) {
    dest = match[1];
    rev = match[2];
  }

  var opts = makeOpts(req, req.query);

  req.db.get(req.params.id, opts, function (err, doc) {
    if (err) return sendError(res, err);
    doc._id = dest;
    doc._rev = rev;
    req.db.put(doc, opts, function (err, response) {
      if (err) return sendError(res, err, 409);
      sendJSON(res, 201, {ok: true});
    });
  });
});


function isHTTP(url) {
  return hasPrefix(url, 'http://');
}

function isHTTPS(url) {
  return hasPrefix(url, 'https://');
}

function hasPrefix(haystack, needle) {
  return haystack.substr(0, needle.length) === needle;
}

//404 handler
app.use(function (req, res, next) {
  sendJSON(res, 404, {
    error: "not_found",
    reason: "missing"
  });
});
