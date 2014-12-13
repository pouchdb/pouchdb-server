"use strict";

var utils = require('../utils');

module.exports = function (app) {
  // Config
  app.get('/_config', function (req, res, next) {
    utils.sendJSON(res, 200, app.couchConfig.getAll());
  });

  app.get('/_config/:section', function (req, res, next) {
    utils.sendJSON(res, 200, app.couchConfig.getSection(req.params.section));
  });

  app.get('/_config/:section/:key', function (req, res, next) {
    var value = app.couchConfig.get(req.params.section, req.params.key);
    sendConfigValue(res, value);
  });

  function sendConfigValue(res, value) {
    if (typeof value === "undefined") {
      return utils.sendJSON(res, 404, {
        error: "not_found",
        reason: "unknown_config_value"
      });
    }
    utils.sendJSON(res, 200, value);
  }

  function putHandler(req, res, next) {
    // Custom JSON parsing, because the default JSON body parser
    // middleware only supports JSON lists and objects. (Not numbers etc.)
    var value;
    try {
      value = JSON.parse(req.rawBody.toString('utf-8'));
    } catch (err) {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "invalid_json"
      });
    }
    if (typeof value !== "string") {
      value = JSON.stringify(value);
    }

    function cb(err, oldValue) {
      utils.sendJSON(res, 200, oldValue || "");
    }
    app.couchConfig.set(req.params.section, req.params.key, value, cb);
  }
  app.put('/_config/:section/:key', utils.parseRawBody, putHandler);

  app.delete('/_config/:section/:key', function (req, res, next) {
    var section = req.params.section;
    var key = req.params.key;
    app.couchConfig.delete(section, key, function (err, oldValue) {
      sendConfigValue(res, oldValue);
    });
  });
};
