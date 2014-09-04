
var startTime  = new Date().getTime()
  , express    = require('express')
  , jsonParser = require('body-parser').json({limit: '1mb'})
  , rawBody    = require('raw-body')
  , fs         = require('fs')
  , path       = require('path')
  , extend     = require('extend')
  , pkg        = require('./package.json')
  , multiparty = require('multiparty')
  , Promise    = require('bluebird')
  , dbs        = {}
  , uuids      = require('./uuids')
  , histories  = {}
  , app        = express();

var Pouch;
module.exports = function(PouchToUse) {
  Pouch = PouchToUse;
  require('pouchdb-all-dbs')(Pouch);
  Pouch.plugin(require('pouchdb-rewrite'));
  Pouch.plugin(require('pouchdb-list'));
  Pouch.plugin(require('pouchdb-show'));
  Pouch.plugin(require('pouchdb-update'));
  Pouch.plugin(require('pouchdb-validation'));
  return app;
};

function registerDB(name, db) {
  db.installValidationMethods();
  dbs[name] = db;
}

function setDBOnReq(db_name, req, res, next) {
  var name = encodeURIComponent(db_name);

  if (name in dbs) {
    req.db = dbs[name];
    return next();
  }

  Pouch.allDbs(function (err, dbs) {
    if (err) {
      return res.send(500, err);
    } else if (dbs.indexOf(name) === -1) {
      return res.send(404, {
        status: 404,
        error: 'not_found',
        reason: 'no_db_file'
      });
    }
    new Pouch(name, function (err, db) {
      if (err) return res.send(412, err);
      registerDB(name, db);
      req.db = db;
      return next();
    });
  });
}

function expressReqToCouchDBReq(req) {
  return {
    body: req.body ? JSON.stringify(req.body) : "undefined",
    cookie: req.cookies || {},
    headers: req.headers,
    method: req.method,
    peer: req.ip,
    query: req.query
  };
}

function sendCouchDBResp(res, err, couchResp) {
    if (err) return res.send(err.status, err);

    res.set(couchResp.headers);
    var body;
    if (couchResp.base64) {
      body = new Buffer(couchResp.base64, 'base64');
    } else {
      body = couchResp.body;
    }
    res.send(couchResp.code, body);
}

app.use(require('compression')());

app.use('/js', express.static(__dirname + '/fauxton/js'));
app.use('/css', express.static(__dirname + '/fauxton/css'));
app.use('/img', express.static(__dirname + '/fauxton/img'));

app.use(function (req, res, next) {
  var opts = {}
    , data = ''
    , prop;

  // Normalize query string parameters for direct passing
  // into Pouch queries.
  for (prop in req.query) {
    try {
      req.query[prop] = JSON.parse(req.query[prop]);
    } catch (e) {}
  }
  next();
});
app.use(function (req, res, next) {
  var _res = res;
  var send = res.send;
  res.send = function() {
    var args = Array.prototype.slice.call(arguments).map(function (arg) {
      if (arg && arg.name && arg.message) {
        var _arg = {
          error: arg.name,
          reason: arg.message
        };
        return _arg;
      }
      return arg;
    });
    send.apply(_res, args);
  };
  next();
});

// Query design document rewrite handler
app.use(function (req, res, next) {
  // Prefers regex over setting the first argument of app.use(), because
  // the last makes req.url relative, which in turn makes most rewrites
  // impossible.
  var match = /\/([^\/]*)\/_design\/([^\/]*)\/_rewrite(.*)/.exec(req.url);
  if (!match) {
    return next();
  }
  setDBOnReq(match[1], req, res, function () {
    var query = match[2] + "/" + match[3];
    var opts = expressReqToCouchDBReq(req);
    req.db.rewriteResultRequestObject(query, opts, function (err, resp) {
      if (err) return res.send(err.status, err);
      req.rawBody = resp.body;
      req.cookies = resp.cookie;
      req.headers = resp.headers;
      req.method = resp.method;
      req.ip = resp.peer;
      req.url = "/" + resp.path.join("/");
      req.query = resp.query;

      //handle the newly generated request.
      next();
    });
  });
});

// Root route, return welcome message
app.get('/', function (req, res, next) {
  res.send(200, {
    'express-pouchdb': 'Welcome!',
    'version': pkg.version
  });
});

app.get('/_session', function (req, res, next) {
  res.send({"ok":true,"userCtx":{"name":null,"roles":["_admin"]},"info":{}});
});

app.get('/_utils', function (req, res, next) {
  res.sendfile(__dirname + '/fauxton/index.html');
});

// Config (stub for now)
app.get('/_config', function (req, res, next) {
  res.send(200, {
    facts: { 
        "pouchdb-server has no config": true,
        "if you use pouchdb-server, you are awesome": true
      }
  });
});

app.put('/_config/:key/:value(*)', function (req, res, next) {
  res.send(200, {ok: true, 'pouchdb-server has no config': true});
});

// Log (stub for now)
app.get('/_log', function (req, res, next) {
  // TODO: implement
  res.send(200, '_log is not implemented yet. PRs welcome!');
});

// Log (stub for now)
app.get('/_stats', function (req, res, next) {
  // TODO: implement
  res.send(200, {'pouchdb-server' : 'has not impemented _stats yet. PRs welcome!'});
});

app.get('/_active_tasks', function (req, res, next) {
  // TODO: implement
  res.send(200, []);
});

// Generate UUIDs
app.get('/_uuids', function (req, res, next) {
  var count = typeof req.query.count === 'number' ? req.query.count : 1;
  res.send(200, {
    uuids: uuids(count)
  });
});

// List all databases.
app.get('/_all_dbs', function (req, res, next) {
  Pouch.allDbs(function (err, response) {
    if (err) res.send(500, Pouch.UNKNOWN_ERROR);
    res.send(200, response);
  });
});

// Replicate a database
app.post('/_replicate', jsonParser, function (req, res, next) {

  var source = req.body.source
    , target = req.body.target
    , opts = { continuous: !!req.body.continuous };

  if (req.body.filter) opts.filter = req.body.filter;
  if (req.body.query_params) opts.query_params = req.body.query_params;

  var startDate = new Date();
  Pouch.replicate(source, target, opts).then(function (response) {
    
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
    res.send(200, response);
  }, function (err) {
    res.send(400, err);
  });

  // if continuous pull replication return 'ok' since we cannot wait for callback
  if (target in dbs && opts.continuous) {
    res.send(200, { ok : true });
  }

});

// Create a database.
app.put('/:db', jsonParser, function (req, res, next) {
  var name = encodeURIComponent(req.params.db);

  if (name in dbs) {
    return res.send(412, {
      'error': 'file_exists',
      'reason': 'The database could not be created.'
    });
  }

  new Pouch(name, function (err, db) {
    if (err) return res.send(412, err);
    registerDB(name, db);
    var loc = req.protocol
      + '://'
      + ((req.hostname === '127.0.0.1') ? '' : req.subdomains.join('.') + '.')
      + req.hostname
      + '/' + name;
    res.location(loc);
    res.send(201, { ok: true });
  });
});

// Delete a database
app.delete('/:db', function (req, res, next) {
  var name = encodeURIComponent(req.params.db);
  Pouch.destroy(name, function (err, info) {
    if (err) return res.send(err.status || 500, err);
    delete dbs[name];
    res.send(200, { ok: true });
  });
});

// At this point, some route middleware can take care of identifying the
// correct Pouch instance.
['/:db/*','/:db'].forEach(function (route) {
  app.all(route, function (req, res, next) {
    setDBOnReq(req.params.db, req, res, next);
  });
});

// Get database information
app.get('/:db', function (req, res, next) {
  req.db.info(function (err, info) {
    if (err) return res.send(404, err);
    info.instance_start_time = startTime.toString();
    res.send(200, info);
  });
});

// Bulk docs operations
app.post('/:db/_bulk_docs', jsonParser, function (req, res, next) {

  // Maybe this should be moved into the leveldb adapter itself? Not sure
  // how uncommon it is for important options to come through in the body
  // https://github.com/daleharvey/pouchdb/issues/435
  var opts = 'new_edits' in req.body
    ? { new_edits: req.body.new_edits }
    : null;

  if (Array.isArray(req.body)) {
    return res.send(400, {
      error: "bad_request",
      reason: "Request body must be a JSON object"
    });
  }

  req.db.bulkDocs(req.body, opts, function (err, response) {
    if (err) return res.send(err.status || 500, err);
    res.send(201, response);
  });

});

// Ensure all commits are written to disk
app.post('/:db/_ensure_full_commit', function (req, res, next) {
  // TODO: implement
  res.send(201, {
    ok: true, 
    instance_start_time: startTime.toString()
  });
});

// All docs operations
app.all('/:db/_all_docs', jsonParser, function (req, res, next) {
  if (req.method !== 'GET' && req.method !== 'POST') return next();

  // Check that the request body, if present, is an object.
  if (!!req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.send(400, Pouch.BAD_REQUEST);
  }

  for (var prop in req.body) {
    req.query[prop] = req.query[prop] || req.body[prop];
  }

  req.db.allDocs(req.query, function (err, response) {
    if (err) return res.send(400, err);
    res.send(200, response);
  });

});

// Monitor database changes
app.get('/:db/_changes', function (req, res, next) {

  // api.changes expects a property `query_params`
  // This is a pretty inefficient way to do it.. Revisit?
  req.query.query_params = JSON.parse(JSON.stringify(req.query));

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
          res.send(err.status || 500, err);
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
              res.send(err.status || 500, err);
            }
            cleanup();
          });
        }
      }).on('error', function (err) {
        if (!written) {
          res.send(err.status || 500, err);
        }
        cleanup();
      });
    }
  } else { // straight shot, not continuous
    req.query.complete = function (err, response) {
      if (err) return res.send(err.status, err);
      res.send(200, response);
    };
    req.db.changes(req.query);
  }
});

// DB Compaction
app.post('/:db/_compact', jsonParser, function (req, res, next) {
  req.db.compact(function (err, response) {
    if (err) return res.send(500, err);
    res.send(200, response);
  });
});

// Revs Diff
app.post('/:db/_revs_diff', jsonParser, function (req, res, next) {
  req.db.revsDiff(req.body || {}, function (err, diffs) {
    if (err) return res.send(400, err);

    res.send(200, diffs);
  });
});

// Temp Views
app.post('/:db/_temp_view', jsonParser, function (req, res, next) {
  if (req.body.map) req.body.map = (new Function('return ' + req.body.map))();
  req.query.conflicts = true;
  req.db.query(req.body, req.query, function (err, response) {
    if (err) return res.send(400, err);
    res.send(200, response);
  });
});

// Query design document info
app.get('/:db/_design/:id/_info', function (req, res, next) {
  // Dummy data for Fauxton
  res.send(200, {
    'name': req.query.id,
    'view_index': 'Not implemented.'
  });
});

// Query a document view
app.get('/:db/_design/:id/_view/:view', function (req, res, next) {
  var query = req.params.id + '/' + req.params.view;
  req.db.query(query, req.query, function (err, response) {
    if (err) return res.send(404, err);
    res.send(200, response);
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

var parseRawBody = function(req, res, next) {
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
function putAttachment(name, req, res) {
  var attachment = req.params.attachment
    , rev = req.query.rev
    , type = req.get('Content-Type') || 'application/octet-stream'
    , body = new Buffer(req.rawBody || '', 'binary')

  req.db.putAttachment(name, attachment, rev, body, type, function (err, response) {
    if (err) return res.send(409, err);
    res.send(200, response);
  });    
}

app.put('/:db/_design/:id/:attachment(*)', parseRawBody, function (req, res, next) {
  putAttachment('_design/' + req.params.id, req, res);
});

app.put('/:db/:id/:attachment(*)', parseRawBody, function (req, res, next) {
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  putAttachment(req.params.id, req, res);
});

// Retrieve a document attachment
function getAttachment(name, req, res) {
  var attachment = req.params.attachment;

  req.db.get(name, req.query, function (err, info) {
    if (err) return res.send(404, err);

    if (!info._attachments || !info._attachments[attachment]) {
      return res.send(404, {status:404, error:'not_found', reason:'missing'});
    };

    var type = info._attachments[attachment].content_type;
 
    req.db.getAttachment(name, attachment, function (err, response) {
      if (err) return res.send(409, err);
      res.set('Content-Type', type);
      res.send(200, response);
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
  var attachment = req.params.attachment
    , rev = req.query.rev;

  req.db.removeAttachment(name, attachment, rev, function (err, response) {
    if (err) return res.send(409, err);
    res.send(200, response);
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
  
  function onResponse(err, response) {
    if (err) {
      return res.send(err.status || 500, err);
    }
    var loc = req.protocol
      + '://'
      + ((req.hostname === '127.0.0.1') ? '' : req.subdomains.join('.') + '.')
      + req.hostname
      + '/' + req.params.db
      + '/' + response.id;
    res.location(loc);
    res.send(201, response);
  }
  
  if (/^multipart\/related/.test(req.headers['content-type'])) {
    // multipart, assuming it's also new_edits=false for now
    var doc;
    var promise = Promise.resolve();
    var form = new multiparty.Form();
    var attachments = {};
    form.on('error', function (err) {
      return res.send(500, err);
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
        req.db.put(doc, req.query, onResponse);
      }).catch(function (err) {
        res.send(err.status || 500, err);
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
    req.db.put(req.body, req.query, onResponse);
  }
});

// Create a document
app.post('/:db', jsonParser, function (req, res, next) {
  req.body._id = uuids(1)[0];
  req.db.put(req.body, req.query, function (err, response) {
    if (err) return res.send(err.status || 500, err);
    res.send(201, response);
  });
});

// Retrieve a document
app.get('/:db/:id(*)', function (req, res, next) {
  req.db.get(req.params.id, req.query, function (err, doc) {
    if (err) return res.send(404, err);
    res.send(200, doc);
  });
});

// Delete a document
app.delete('/:db/:id(*)', function (req, res, next) {
  req.db.get(req.params.id, req.query, function (err, doc) {
    if (err) return res.send(404, err);
    req.db.remove(doc, function (err, response) {
      if (err) return res.send(404, err);
      res.send(200, response);
    });
  });
});

// Copy a document
app.copy('/:db/:id', function (req, res, next) {
  var dest = req.get('Destination')
    , rev
    , match;

  if (!dest) {
    return res.send(400, {
      'error': 'bad_request',
      'reason': 'Destination header is mandatory for COPY.'
    });
  }

  if (match = /(.+?)\?rev=(.+)/.exec(dest)) {
    dest = match[1];
    rev = match[2];
  }

  req.db.get(req.params.id, req.query, function (err, doc) {
    if (err) return res.send(404, err);
    doc._id = dest;
    doc._rev = rev;
    req.db.put(doc, function (err, response) {
      if (err) return res.send(409, err);
      res.send(200, doc);
    });
  });
});
