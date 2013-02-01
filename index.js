
var express = require('express')
  , Pouch   = require('pouchdb')
  , app     = express()
  , dbs     = {};

module.exports = app;

function prefix (name) {
  return 'leveldb://' + name;
}

// Logging
app.use(express.logger('dev'));

// Create a database.
// Return 201, { ok: true } on success
// Return 412 on failure
app.put('/:name', function (req, res, next) {
  Pouch(prefix(req.params.name), function (err, db) {
    if (err) {
      res.json(err);
      res.send(412);
    } else {
      dbs[req.params.name] = db;
      res.json({ ok: true });
      res.send(201);
    }
  });
});

// Delete a database
// Return 200, { ok: true } on success
// Return 404 on failure
app.del('/:name', function (req, res, next) {
  Pouch.destroy(prefix(req.params.name), function (err, info) {
    if (err) {
      res.json(err);
      res.send(404);
    } else {
      delete dbs[req.params.name];
      res.json({ ok: true });
      res.send(200);
    }
  });
});

// Get database information
// Return 200 with info on success
// Return 404 on failure
app.get('/:name', function (req, res, next) {
  if (req.params.name in dbs) {
    dbs[req.params.name].info(function (err, info) {
      if (err) {
        res.json(err);
        res.send(404);
      } else {
        res.json(info);
        res.send(200);
      }
    });
  } else {
    res.send(404);
  }
});

// Create a document
// Return 201 with document information on success
// Return 404? on failure
app.post('/:name', function (req, res, next) {
  if (req.params.name in dbs) {
    dbs[req.params.name].post(req.body, function (err, response) {
      if (err) return res.send(404);
      res.json(response);
      res.send(201);
    });
  }
});
