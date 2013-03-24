
var express   = require('express')
  , Pouch     = require('pouchdb')
  , uuid      = require('node-uuid')
  , fs        = require('fs')
  , corser    = require("corser")
  , app       = express()
  , corserRequestListener = corser.create()
  , dbs       = {}
  , protocol  = 'leveldb://';

module.exports = app;

app.configure(function () {
  app.use(express.logger('dev'));
  app.use(function (req, res, next) {
    // Route req and res through the request listener.
    corserRequestListener(req, res, function () {
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

      // Custom bodyParsing because express.bodyParser() chokes
      // on `malformed` requests.
      req.on('data', function (chunk) { data += chunk; });
      req.on('end', function () {
        if (data) {
          try {
            req.body = JSON.parse(data);
          } catch (e) {
            req.body = data;
          }
        }
        next();
      });
    });
  });
});

// TODO: Remove this: https://github.com/nick-thompson/pouch-server/issues/1
app.get('/_uuids', function (req, res, next) {
  req.query.count = req.query.count || 1;
  res.send(200, {
    uuids: (new Array(req.query.count)).map(function () {
      return uuid.v4();
    })
  });
});

app.get('/', function (req, res, next) {
  res.send(200, {
    'pouchdb-server': 'Welcome!',
    'version': '0.1.0'
  });
});

// Create a database.
app.put('/:db', function (req, res, next) {
  if (req.params.db in dbs) return res.send(201, { ok: true });
  Pouch(protocol + req.params.db, function (err, db) {
    if (err) return res.send(412, err);
    dbs[req.params.db] = db;
    res.send(201, { ok: true });
  });
});

// Delete a database
app.del('/:db', function (req, res, next) {
  Pouch.destroy(protocol + req.params.db, function (err, info) {
    if (err) return res.send(404, err);
    delete dbs[req.params.db];
    res.send(200, { ok: true });
  });
});

// At this point, some route middleware can take care of identifying the
// correct Pouch instance.
app.all('/:db/*', function (req, res, next) {
  var name = req.params.db;

  if (name in dbs) {
    req.db = dbs[name];
    return next();
  }

  // Check for the data stores, and rebuild a Pouch instance if able
  fs.stat(name, function (err, stats) {
    if (err && err.code == 'ENOENT') {
      return res.send(404, {
        status: 404,
        error: 'not_found',
        reason: 'no_db_file'
      });
    }

    if (stats.isDirectory()) {
      Pouch(protocol + name, function (err, db) {
        if (err) return res.send(412, err);
        dbs[name] = db;
        req.db = db;
        return next();
      });
    }
  });

});

// Get database information
app.get('/:db', function (req, res, next) {
  req.db.info(function (err, info) {
    if (err) return res.send(404, err);
    res.send(200, info);
  });
});

// Bulk docs operations
app.post('/:db/_bulk_docs', function (req, res, next) {

  // Maybe this should be moved into the leveldb adapter itself? Not sure
  // how uncommon it is for important options to come through in the body
  // https://github.com/daleharvey/pouchdb/issues/435
  var opts = 'new_edits' in req.body
    ? { new_edits: req.body.new_edits }
    : null;

  req.db.bulkDocs(req.body, opts, function (err, response) {
    if (err) return res.send(400, err);
    res.send(201, response);
  });

});

// All docs operations
app.all('/:db/_all_docs', function (req, res, next) {
  if (req.method !== 'GET' && req.method !== 'POST') return next();

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

  var longpoll = function (err, data) {
    if (err) return res.send(409, err);
    if (data.results && data.results.length) {
      data.last_seq = Math.max.apply(Math, data.results.map(function (r) {
        return r.seq;
      }));
      res.send(200, data);
    } else {
      delete req.query.complete;
      req.query.continuous = true;
      req.query.onChange = function (change) {
        res.send(200, change);
      };
      req.db.changes(req.query);
    }
  };

  if (req.query.feed) {
    req.socket.setTimeout(86400 * 1000);
    req.query.complete = longpoll;
  } else {
    req.query.complete = function (err, response) {
      if (err) return res.send(409, err);
      res.send(200, response);
    };
  }

  req.db.changes(req.query);

});

// Revs Diff
app.post('/:db/_revs_diff', function (req, res, next) {
  req.db.revsDiff(req.body, function (err, diffs) {
    if (err) return res.send(400, err);
    res.send(200, diffs);
  });
});

// Temp Views
app.post('/:db/_temp_view', function (req, res, next) {
  if (req.body.map) req.body.map = (new Function('return ' + req.body.map))();
  req.query.conflicts = true;
  req.db.query(req.body, req.query, function (err, response) {
    if (err) return res.send(400, err);
    res.send(200, response);
  });
});

// Put a document attachment
app.put('/:db/:id/:attachment', function (req, res, next) {

  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }

  var name = req.params.id + '/' + req.params.attachment
    , rev = req.query.rev
    , type = req.get('Content-Type')
    , body = typeof req.body === 'string'
        ? new Buffer(req.body)
        : new Buffer(JSON.stringify(req.body));

  req.db.putAttachment(name, rev, body, type, function (err, response) {
    if (err) return res.send(409, err);
    res.send(200, response);
  });

});

// Delete a document attachment
app.del('/:db/:id/:attachment', function (req, res, next) {

  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }

  var name = req.params.id + '/' + req.params.attachment
    , rev = req.query.rev;

  req.db.removeAttachment(name, rev, function (err, response) {
    if (err) return res.send(409, err);
    res.send(200, response);
  });

});

// Create a document
app.put('/:db/:id(*)', function (req, res, next) {
  req.body._id = req.body._id || req.query.id;
  req.db.put(req.body, req.query, function (err, response) {
    if (err) return res.send(409, err);
    res.send(201, response);
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

// Retrieve a document
app.get('/:db/:id(*)', function (req, res, next) {
  req.db.get(req.params.id, req.query, function (err, doc) {
    if (err) return res.send(404, err);
    res.send(200, doc);
  });
});

// Delete a document
app.del('/:db/:id(*)', function (req, res, next) {
  req.db.get(req.params.id, req.query, function (err, doc) {
    if (err) return res.send(404, err);
    req.db.remove(doc, function (err, response) {
      if (err) return res.send(404, err);
      res.send(200, response);
    });
  });
});

