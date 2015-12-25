"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'routes/authentication');
  utils.requires(app, 'config-infrastructure');

  function getUsersDB(req) {
    return utils.getUsersDB(app, req.PouchDB);
  }

  app.get('/_session', function (req, res, next) {
    utils.sendJSON(res, 200, req.couchSession);
  });

  function postHandler(req, res, next) {
    var name = req.body.name;
    var password = req.body.password;
    getUsersDB(req).then(function (db) {
      return db.multiUserLogIn(name, password);
    }).then(function (resp) {
      res.cookie('AuthSession', resp.sessionID, {httpOnly: true});
      delete resp.sessionID;
      if (req.query.next) {
        utils.setLocation(res, req.query.next);
        return res.status(302).end();
      }
      utils.sendJSON(res, 200, resp);
    }).catch(function (err) {
      utils.sendError(res, err);
    });
  }
  app.post('/_session', utils.jsonParser, utils.urlencodedParser, postHandler);

  app.delete('/_session', function (req, res, next) {
    res.clearCookie('AuthSession');
    utils.sendJSON(res, 200, {ok: true});
  });
};
