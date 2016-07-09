"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Monitor database changes
  function changes(req, res, next) {

    utils.setJsonOrPlaintext(res);

    // api.changes expects a property `query_params`
    // This is a pretty inefficient way to do it.. Revisit?
    req.query.query_params = JSON.parse(JSON.stringify(req.query));

    req.query = utils.makeOpts(req, req.query);

    if (req.body && req.body.doc_ids) {
      req.query.doc_ids = req.body.doc_ids;
    }

    if (req.query.feed === 'continuous' || req.query.feed === 'longpoll') {
      var changes;
      var heartbeatInterval;
      // 60000 is the CouchDB default
      // TODO: figure out if we can make this default less aggressive
      var heartbeat = (typeof req.query.heartbeat === 'number') ?
        req.query.heartbeat : 6000;
      var written = false;
      heartbeatInterval = setInterval(function () {
        // The location of the destroyed value seems to change depend on the version of node and if the
        // connection is encrypted or not so we check two different locations
        if (res.connection.destroyed || (res.connection.socket && res.connection.socket.destroyed)) {
          return cleanup();
        }

        written = true;
        res.write('\n');
      }, heartbeat);

      var cleanup = function () {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        if (changes) {
          changes.cancel();
        }

        res.end();
      };

      if (req.query.feed === 'continuous') {
        req.query.live = req.query.continuous = true;
        changes = req.db.changes(req.query).on('change', function (change) {
          written = true;
          utils.writeJSON(res, change);
        }).on('error', function (err) {
          if (!written) {
            utils.sendError(res, err);
          }

          cleanup();
        });
      } else { // longpoll
        // first check if there are >0. if so, return them immediately
        req.query.live = req.query.continuous = false;
        req.db.changes(req.query).then(function (complete) {
          if (complete.results.length) {
            utils.writeJSON(res, complete);
            cleanup();
          } else { // do the longpolling
            // mimicking CouchDB, start sending the JSON immediately
            res.write('{"results":[\n');
            req.query.live = req.query.continuous = true;
            changes = req.db.changes(req.query)
              .on('change', function (change) {
                utils.writeJSON(res, change);
                res.write('],\n"last_seq":' + change.seq + '}\n');
                cleanup();
              }).on('error', function (err) {
                // shouldn't happen
                console.log(err);
                cleanup();
              });
          }
        }, function (err) {
          if (!written) {
            utils.sendError(res, err);
          }
          cleanup();
        });
      }
    } else { // straight shot, not continuous
      req.db.changes(req.query).then(function (response) {
        utils.sendJSON(res, 200, response);
      }).catch(function (err) {
        utils.sendError(res, err);
      });
    }
  }
  app.get('/:db/_changes', changes);
  app.post('/:db/_changes', utils.jsonParser, changes);
};
