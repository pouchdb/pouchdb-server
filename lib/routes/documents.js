"use strict";

var fs         = require('fs'),
    multiparty = require('multiparty'),
    utils      = require('../utils'),
    uuids      = require('../uuids'),
    extend     = require('extend'),
    Promise    = require('bluebird');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Create or update document that has an ID
  app.put('/:db/:id(*)', utils.jsonParser, function (req, res, next) {

    var opts = utils.makeOpts(req, req.query);

    function onResponse(err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      res.set('ETag', '"' + response.rev + '"');
      utils.setLocation(res, req.params.db + '/' + response.id);
      utils.sendJSON(res, 201, response);
    }

    if (/^multipart\/related/.test(req.headers['content-type'])) {
      // multipart, assuming it's also new_edits=false for now
      var doc;
      var promise = Promise.resolve();
      var form = new multiparty.Form();
      var attachments = {};
      form.on('error', function (err) {
        return utils.sendError(res, err);
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
          utils.sendError(res, err);
        });
      });
      form.parse(req);
    } else {
      // normal PUT
      req.body._id = req.body._id || req.query.id;
      if (!req.body._id) {
        req.body._id = (!!req.params.id && req.params.id !== 'null') ?
          req.params.id : null;
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
      return utils.sendJSON(req.res, 400, {
        error: 'bad_request',
        reason: (
          "Document rev from request body and " +
          "query string have different values"
        )
      });
    }
    var etagRev;
    if (etagRevExists) {
      etagRev = req.get('If-Match').slice(1, -1);
      if (docRevExists && doc._rev !== etagRev) {
        return utils.sendJSON(req.res, 400, {
          error: 'bad_request',
          reason: "Document rev and etag have different values"
        });
      }
      if (queryRevExists && req.query.rev !== etagRev) {
        return utils.sendJSON(req.res, 400, {
          error: 'bad_request',
          reason: "Document rev and etag have different values"
        });
      }
    }

    return doc._rev || req.query.rev || etagRev;
  }

  // Create a document
  app.post('/:db', utils.jsonParser, function (req, res, next) {
    var opts = utils.makeOpts(req, req.query);

    req.body._id = req.body._id || uuids(1)[0];
    req.db.put(req.body, opts, function (err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.setLocation(res, req.params.db + '/' + response.id);
      utils.sendJSON(res, 201, response);
    });
  });

  // Retrieve a document
  app.get('/:db/:id(*)', function (req, res, next) {
    var opts = utils.makeOpts(req, req.query);

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }

      res.set('ETag', '"' + doc._rev + '"');
      utils.sendJSON(res, 200, doc);
    });
  });

  // Delete a document
  app.delete('/:db/:id(*)', function (req, res, next) {
    var opts = utils.makeOpts(req, req.query);
    opts.rev = getRev(req, {});

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }
      req.db.remove(doc, opts, function (err, response) {
        if (err) {
          return utils.sendError(res, err);
        }
        utils.sendJSON(res, 200, response);
      });
    });
  });

  // Copy a document
  app.copy('/:db/:id', function (req, res, next) {
    var dest = req.get('Destination');
    var rev, match;

    if (!dest) {
      return utils.sendJSON(res, 400, {
        'error': 'bad_request',
        'reason': 'Destination header is mandatory for COPY.'
      });
    }

    if (isHTTP(dest) || isHTTPS(dest)) {
      return utils.sendJSON(res, 400, {
        'error': 'bad_request',
        'reason': 'Destination URL must be relative.'
      });
    }

    if ((match = /(.+?)\?rev=(.+)/.exec(dest))) {
      dest = match[1];
      rev = match[2];
    }

    var opts = utils.makeOpts(req, req.query);

    req.db.get(req.params.id, opts, function (err, doc) {
      if (err) {
        return utils.sendError(res, err);
      }
      doc._id = dest;
      doc._rev = rev;
      req.db.put(doc, opts, function (err, response) {
        if (err) {
          return utils.sendError(res, err, 409);
        }
        utils.sendJSON(res, 201, {ok: true});
      });
    });
  });
};

function isHTTP(url) {
  return hasPrefix(url, 'http://');
}

function isHTTPS(url) {
  return hasPrefix(url, 'https://');
}

function hasPrefix(haystack, needle) {
  return haystack.substr(0, needle.length) === needle;
}
