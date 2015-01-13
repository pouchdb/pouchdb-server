"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Put a document attachment
  function putAttachment(db, name, req, res) {
    utils.parseRawBody(req, res, function () {
      var attachment = req.params.attachment,
          rev = req.query.rev,
          type = req.get('Content-Type') || 'application/octet-stream',
          body = new Buffer(req.rawBody || '', 'binary'),
          opts = utils.makeOpts(req);

      function cb(err, response) {
        if (err) {
          return utils.sendError(res, err);
        }
        res.set('ETag', JSON.stringify(response.rev));
        var attachmentURI = encodeURIComponent(attachment);
        utils.setLocation(res, db + '/' + name + '/' + attachmentURI);
        utils.sendJSON(res, 201, response);
      }
      req.db.putAttachment(name, attachment, rev, body, type, opts, cb);
    });
  }

  app.put('/:db/_design/:id/:attachment(*)', function (req, res, next) {
    putAttachment(req.params.db, '_design/' + req.params.id, req, res);
  });

  app.put('/:db/:id/:attachment(*)', function (req, res, next) {
    // Be careful not to catch normal design docs or local docs
    if (req.params.id === '_design' || req.params.id === '_local') {
      return next();
    }
    putAttachment(req.params.db, req.params.id, req, res);
  });

  // Retrieve a document attachment
  function getAttachment(name, req, res) {
    var attachment = req.params.attachment;
    var opts = utils.makeOpts(req, req.query);

    req.db.get(name, opts, function (err, info) {
      if (err) {
        return utils.sendError(res, err);
      }

      if (!info._attachments || !info._attachments[attachment]) {
        return utils.sendJSON(res, 404, {
          error: 'not_found',
          reason: 'missing'
        });
      }

      var type = info._attachments[attachment].content_type;
      var md5 = info._attachments[attachment].digest.slice(4);

      req.db.getAttachment(name, attachment, function (err, response) {
        if (err) {
          return utils.sendError(res, err);
        }
        res.set('ETag', JSON.stringify(md5));
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
    var attachment = req.params.attachment,
        rev = req.query.rev,
        opts = utils.makeOpts(req);

    function cb(err, response) {
      if (err) {
        return utils.sendError(res, err);
      }
      utils.sendJSON(res, 200, response);
    }
    req.db.removeAttachment(name, attachment, rev, opts, cb);
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
};
