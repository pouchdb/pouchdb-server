
var fs        = require('fs')
  , Pouch     = require('pouchdb')
  , uuid      = require('node-uuid')
  , dbs       = {}
  , protocol  = 'leveldb://'
  , express   = require('express')
  , useCorser = false;


app = module.exports = express();
//app.use(express.logger('dev'));

Pouch.enableAllDbs = true;
 
if (useCorser) {
  var corser    = require("corser");
  var corserRequestListener = corser.create({
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE']
  });
  app.use(function (req, res, next) {
    // Route req and res through the request listener.
    corserRequestListener(req, res, function () {
      if (req.method == 'OPTIONS') {
        // End CORS preflight request.
        res.writeHead(204);
        res.end();
      } else {
       normalize_query(req,res,next);
      }
    });
  });
} else {
  app.use(normalize_query);
}

function normalize_query(req,res,next) {  // Normalize query string parameters for direct passing
 var opts = {}            // into Pouch queries.
    , data = ''
    , prop;

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
}


app.get('/', function (req, res, next) {
  res.send(200, {
    'pouchdb-server': 'Welcome!',
    'version': '0.1.0'
  });
});

// TODO: Remove this: https://github.com/nick-thompson/pouch-server/issues/1
app.get('/_uuids', function (req, res, next) {
  var count = req.query.count || 1
    , uuids = [];

  while (--count >= 0) { uuids.push(uuid.v4()); }
  res.send(200, {
    uuids: uuids
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
app.post('/_replicate', function (req, res, next) {

  var source = req.body.source
    , target = req.body.target
    , opts = { continuous: !!req.body.continuous };

  if (req.body.filter) opts.filter = req.body.filter;
  opts.complete = function (err, response) {
    if (err) return res.send(400, err);
    res.send(200, response);
  };

  Pouch.replicate(source, target, opts);

  // if continuous pull replication return 'ok' since we cannot wait for callback
  if (target in dbs && opts.continuous) {
    res.send(200, { ok : true });
  }

});


// Create a database.
app.put('/:db', function (req, res, next) {
  var name = encodeURIComponent(req.params.db);
  if (name in dbs) {
    return res.send(412, {
      'error': 'file_exists',
      'reason': 'The database could not be created.'
    });
  }

  Pouch(protocol + name, function (err, db) {
    if (err) return res.send(412, err);
    dbs[name] = db;
    var loc = req.protocol
      + '://'
      + ((req.host === '127.0.0.1') ? '' : req.subdomains.join('.') + '.')
      + req.host
      + '/' + name;
    res.location(loc);
    res.send(201, { ok: true });
  });
});

// Delete a database
app.del('/:db', function (req, res, next) {
  var name = encodeURIComponent(req.params.db);
  Pouch.destroy(protocol + name, function (err, info) {
    if (err) return res.send(404, err);
    delete dbs[name];
    res.send(200, { ok: true });
  });
});

// At this point, some route middleware can take care of identifying the
// correct Pouch instance.
['/:db/*','/:db'].forEach(function (route) { app.all(route, function (req, res, next) {
  var name = encodeURIComponent(req.params.db);

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

})});

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

  if (req.query.filter) {
    // CouchDB seems to default these to true when a filter is applied
    req.query.conflicts = true;
    req.query.include_docs = true;
  }

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

// DB Compaction
app.post('/:db/_compact', function (req, res, next) {
  req.db.compact(function (err, response) {
    if (err) return res.send(500, err);
    res.send(200, response);
  });
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

// Create or update document that has an ID
app.put('/:db/:id(*)', function (req, res, next) {
  req.body._id = req.body._id || req.query.id;
  if (!req.body._id) {
    req.body._id = (!!req.params.id && req.params.id !== 'null')
      ? req.params.id
      : null;
  }
  req.db.put(req.body, req.query, function (err, response) {
    if (err) return res.send(409, err);
    var loc = req.protocol
      + '://'
      + ((req.host === '127.0.0.1') ? '' : req.subdomains.join('.') + '.')
      + req.host
      + '/' + req.params.db
      + '/' + req.body._id;
    res.location(loc);
    res.send(201, response);
  });
});

// Create a document
app.post('/:db(*)', function (req, res, next) {
  req.db.post(req.body, req.query, function (err, response) {
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