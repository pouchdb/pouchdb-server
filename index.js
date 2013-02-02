
var express = require('express')
  , Pouch   = require('pouchdb')
  , uuid    = require('node-uuid')
  , app     = express()
  , dbs     = {};

app.configure(function () {
  app.use(express.logger('dev'));
  app.use(function (req, res, next) {
    var opts = {}
      , data = ''
      , prop;

    // Pouch options come in as query string parameters,
    // but need to be mapped back to an options object.
    for (prop in req.query)
      opts[prop] = req.query[prop];
    req.opts = opts;

    // Custom bodyParsing because express.bodyParser() chokes
    // on `malformed` requests.
    req.on('data', function (chunk) { data += chunk; });
    req.on('end', function () {
      if (data) req.body = JSON.parse(data);
      next();
    });

  });
});

module.exports = app;

function prefix (db) {
  return 'leveldb://' + db;
}

app.get('/_uuids', function (req, res, next) {
  req.query.count = req.query.count || 1;
  res.send(200, {
    uuids: (new Array(req.query.count)).map(function () {
      return uuid.v4();
    })
  });
});

// Create a database.
// Return 201, { ok: true } on success
// Return 412 on failure
app.put('/:db', function (req, res, next) {
  Pouch(prefix(req.params.db), function (err, db) {
    if (err) {
      res.send(412, err);
    } else {
      dbs[req.params.db] = db;
      res.send(201, { ok: true });
    }
  });
});

// Delete a database
// Return 200, { ok: true } on success
// Return 404 on failure
app.del('/:db', function (req, res, next) {
  Pouch.destroy(prefix(req.params.db), function (err, info) {
    if (err) {
      res.send(404, err);
    } else {
      delete dbs[req.params.db];
      res.send(200, { ok: true });
    }
  });
});

// Get database information
// Return 200 with info on success
// Return 404 on failure
app.get('/:db', function (req, res, next) {
  if (req.params.db in dbs) {
    dbs[req.params.db].info(function (err, info) {
      if (err) {
        res.send(404, err);
      } else {
        res.send(200, info);
      }
    });
  } else {
    res.send(404);
  }
});

// Bulk docs operations
// Return 201 with document information on success
// Return 409 on error
app.post('/:db/_bulk_docs', function (req, res, next) {
  if (req.params.db in dbs) {
    dbs[req.params.db].bulkDocs(req.body, function (err, response) {
      if (err) return res.send(409, err);
      res.send(201, response);
    });
  }
});

app.get('/:db/_changes', function (req, res, next) {
  if (req.params.db in dbs) {
    dbs[req.params.db].changes(req.opts, function (err, response) {
      if (err) return res.send(409, err);
      res.send(200, response);
    });
  }
});

// PUT a document
// Return 201 with document information on success
// Return 409 on failure
app.put('/:db/:id(*)', function (req, res, next) {
  if (req.params.db in dbs) {
    req.body._id = req.params.id;
    dbs[req.params.db].put(req.body, function (err, response) {
      if (err) {
        res.send(409, err);
      } else {
        res.send(201, response);
      }
    });
  }
});

// Retrieve a document
// Return 200 with document info on success
// Return 404 on failure
app.get('/:db/:id(*)', function (req, res, next) {
  if (req.params.db in dbs) {
    dbs[req.params.db].get(req.params.id, req.opts, function (err, doc) {
      if (err) return res.send(404, err);
      res.send(200, doc);
    });
  }
});

// Delete a document
// Return 200 with deleted revision number on success
// Return 404 on failure
app.del('/:db/:id(*)', function (req, res, next) {
  if (req.params.db in dbs) {
    var id = req.params.id
      , opts = { rev: req.query.rev }
      , db = dbs[req.params.db];

    db.get(id, opts, function (err, doc) {
      if (err) return res.send(404, err);
      db.remove(doc, function (err, response) {
        if (err) return res.send(404, err);
        res.send(200, response);
      });
    });
  }
});

