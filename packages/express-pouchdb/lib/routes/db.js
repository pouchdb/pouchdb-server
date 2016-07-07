"use strict";

var startTime = new Date().getTime(),
    utils     = require('../utils'),
    wrappers  = require('pouchdb-wrappers');

module.exports = function (app) {
  // Create a database.
  app.put('/:db', utils.jsonParser, function (req, res, next) {
    var decodedName = req.params.db;
    var name = encodeURIComponent(decodedName);

    req.PouchDB.allDbs(function (err, dbs) {
      if (err) {
        return utils.sendError(res, err);
      }

      if (dbs.indexOf(decodedName) !== -1) {
        return utils.sendJSON(res, 412, {
          'error': 'file_exists',
          'reason': 'The database could not be created.'
        });
      }

      // PouchDB.new() instead of new PouchDB() because that adds
      // authorisation logic
      var db = req.PouchDB.new(name, utils.makeOpts(req));
      db.info(function (err, db) {
        if (err) {
          return utils.sendError(res, err, 412);
        }
        utils.setLocation(res, name);
        utils.sendJSON(res, 201, {ok: true});
      });
    });
  });

  // Delete a database
  app.delete('/:db', function (req, res, next) {
    if (req.query.rev) {
      return utils.sendJSON(res, 400, {
        error: 'bad_request',
        reason: (
          "You tried to DELETE a database with a ?rev= parameter. " +
          "Did you mean to DELETE a document instead?"
        )
      });
    }
    var name = encodeURIComponent(req.params.db);
    req.PouchDB.destroy(name, utils.makeOpts(req), function (err, info) {
      if (err) {
        return utils.sendError(res, err);
      }

      utils.sendJSON(res, 200, {ok: true});
    });
  });

  // At this point, some route middleware can take care of identifying the
  // correct PouchDB instance.
  ['/:db/*', '/:db'].forEach(function (route) {
    app.all(route, function (req, res, next) {
      utils.setDBOnReq(req.params.db, app.dbWrapper, req, res, next);
    });
  });

  // Get database information
  app.get('/:db', function (req, res, next) {
    req.db.info(utils.makeOpts(req), function (err, info) {
      if (err) {
        return utils.sendError(res, err);
      }
      info.instance_start_time = startTime.toString();
      // TODO: data_size?
      utils.sendJSON(res, 200, info);
    });
  });

  // Ensure all commits are written to disk
  app.post('/:db/_ensure_full_commit', function (req, res, next) {
    // TODO: implement. Also check security then: who is allowed to
    // access this? (db & server admins?)
    utils.sendJSON(res, 201, {
      ok: true,
      instance_start_time: startTime.toString()
    });
  });

  app.dbWrapper.registerWrapper(function (name, db, next) {
    // db.info() should just return the non-uri encoded db name
    wrappers.installWrapperMethods(db, {
      info: function (orig, args) {
        return orig().then(function (info) {
          info.db_name = decodeURIComponent(info.db_name);
          return info;
        });
      }
    });

    return next();
  });

  app.daemonManager.registerDaemon({
    start: function (PouchDB) {
      // PouchDB.allDbs() should return the non-uri encoded db name
      wrappers.installStaticWrapperMethods(PouchDB, {
        allDbs: function (orig, args) {
          return orig().then(function (dbs) {
            return dbs.map(decodeURIComponent);
          });
        }
      });
    }
  });
};
