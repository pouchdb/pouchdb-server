"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/db');

  // Monitor database changes
  function changes(req, res, next) {

    // api.changes expects a property `query_params`
    // This is a pretty inefficient way to do it.. Revisit?
    req.query.query_params = JSON.parse(JSON.stringify(req.query));

    req.query = utils.makeOpts(req, req.query);

    if (req.body && req.body.doc_ids) {
      req.query.doc_ids = req.body.doc_ids;
    }

    if (req.query.feed === 'continuous' || req.query.feed === 'longpoll') {
      var heartbeatInterval;
      // 60000 is the CouchDB default
      // TODO: figure out if we can make this default less aggressive
      var heartbeat = (typeof req.query.heartbeat === 'number') ?
        req.query.heartbeat : 6000;
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
            utils.sendError(res, err);
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
            var changes = req.db.changes(req.query)
              .on('change', function (change) {
                written = true;
                res.write(JSON.stringify({
                  results: [change],
                  last_seq: change.seq
                }) + '\n');
                res.end();
                changes.cancel();
                cleanup();
              })
              .on('error', function (err) {
                if (!written) {
                  utils.sendError(res, err);
                }
                cleanup();
              });
          }
        }).on('error', function (err) {
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
