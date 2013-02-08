
/**
 * Module dependencies and global variables.
 */

var express   = require('express')
  , Pouch     = require('./pouchdb')
  , uuid      = require('node-uuid')
  , app       = express()
  , dbs       = {}
  , protocol  = 'leveldb://';

/**
 * Server configuration.
 */

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

/**
 * Export the express app itself.
 */

module.exports = app;

/**
 * Delegate calls to a PouchDB instance, and cache
 * Pouch instances in the running instance of the server.
 *
 * @param {string} name Database name
 * @param {string} callback
 */

function delegate (name, callback) {
  if (name in dbs) return callback(null, dbs[name]);
  Pouch(protocol + name, function (err, db) {
    dbs[name] = db;
    callback(err, db);
  });
}

// Generate UUIDs
// Return 200 with a set of UUIDs on success
app.get('/_uuids', function (req, res, next) {
  req.opts.count = req.opts.count || 1;
  res.send(200, {
    uuids: (new Array(req.opts.count)).map(function () {
      return uuid.v4();
    })
  });
});

// Create a database.
// Return 201, { ok: true } on success
// Return 412 on failure
app.put('/:db', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(412, err);
    res.send(201, { ok: true });
  });
});

// Delete a database
// Return 200, { ok: true } on success
// Return 404 on failure
app.del('/:db', function (req, res, next) {
  Pouch.destroy(protocol + req.params.db, function (err, info) {
    if (err) return res.send(404, err);
    delete dbs[req.params.db];
    res.send(200, { ok: true });
  });
});

// Get database information
// Return 200 with info on success
// Return 404 on failure
app.get('/:db', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(404, err);
    db.info(function (err, info) {
      if (err) return res.send(404, err);
      res.send(200, info);
    });
  });
});

// Bulk docs operations
// Return 201 with document information on success
// Return 409 on failure
app.post('/:db/_bulk_docs', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(409, err);
    db.bulkDocs(req.body, function (err, response) {
      if (err) return res.send(409, err);
      res.send(201, response);
    });
  });
});

app.get('/:db/_all_docs', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(404, err);
    db.allDocs(req.opts, function (err, response) {
      if (err) return res.send(400, err);
      res.send(200, response);
    });
  });
});

// Monitor database changes
// Return 200 with change set on success
// Return 409 on failure
app.get('/:db/_changes', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(409, err);
    req.opts.complete = function (err, response) {
      if (err) return res.send(409, err);
      res.send(200, response);
    };
    db.changes(req.opts);
  });
});

// Revs Diff
// Return 200 with revs diff on success
// Return 400 on failure
app.post('/:db/_revs_diff', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(400, err);
    db.revsDiff(req.body, function (err, diffs) {
      if (err) return res.send(400, err);
      res.send(200, diffs);
    });
  });
});

// PUT a document
// Return 201 with document information on success
// Return 409 on failure
app.put('/:db/:id(*)', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(409, err);
    req.body._id = req.body._id || req.opts.id;
    db.put(req.body, function (err, response) {
      if (err) return res.send(409, err);
      res.send(201, response);
    });
  });
});

// Retrieve a document
// Return 200 with document info on success
// Return 404 on failure
app.get('/:db/:id(*)', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(409, err);
    db.get(req.params.id, req.opts, function (err, doc) {
      if (err) return res.send(404, err);
      res.send(200, doc);
    });
  });
});

// Delete a document
// Return 200 with deleted revision number on success
// Return 404 on failure
app.del('/:db/:id(*)', function (req, res, next) {
  delegate(req.params.db, function (err, db) {
    if (err) return res.send(404, err);
    db.get(req.params.id, req.opts, function (err, doc) {
      if (err) return res.send(404, err);
      db.remove(doc, function (err, response) {
        if (err) return res.send(404, err);
        res.send(200, response);
      });
    });
  });
});

