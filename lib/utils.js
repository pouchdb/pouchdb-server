"use strict";

var rawBody         = require('raw-body'),
    express         = require('express'),
    CouchConfig     = require('./couch_config'),
    DatabaseWrapper = require('./db_wrapper');

//shared middleware
exports.jsonParser = require('body-parser').json({limit: '1mb'});
exports.urlencodedParser = require('body-parser').urlencoded({extended: false});

//helpers
exports.getApp = function (app) {
  return app || express();
};

exports.getConfig = function (config) {
  return config || new CouchConfig('./config.json');
};

exports.getDBWrapper = function (dbWrapper) {
  return dbWrapper || new DatabaseWrapper();
};

exports.loadRoutesIn = function (paths, PouchDB, app, config, dbWrapper) {
  paths.forEach(function (path) {
    require(path)(PouchDB, app, config, dbWrapper);
  });
};

exports.makeOpts = function (req, startOpts) {
  // fill in opts so it can be used by authorisation logic
  var opts = startOpts || {};
  opts.userCtx = (req.couchSession || {}).userCtx;
  opts.secObj = req.couchSessionObj;

  return opts;
};

exports.setDBOnReq = function (PouchDB, db_name, dbWrapper, req, res, next) {
  var name = encodeURIComponent(db_name);

  PouchDB.allDbs(function (err, dbs) {
    if (err) {
      return exports.sendError(res, err);
    }

    if (dbs.indexOf(name) === -1) {
      return exports.sendJSON(res, 404, {
        error: 'not_found',
        reason: 'no_db_file'
      });
    }
    new PouchDB(name, function (err, db) {
      if (err) {
        return exports.sendError(res, err, 412);
      }
      dbWrapper.wrap(name, db).then(function () {
        req.db = db;

        next();
      });
    });
  });
};

exports.expressReqToCouchDBReq = function (req) {
  return exports.makeOpts(req, {
    body: req.rawBody ? req.rawBody.toString() : "undefined",
    cookie: req.cookies || {},
    headers: req.headers,
    method: req.method,
    path: splitPath(req.url.split("?")[0]),
    peer: req.ip,
    query: req.query,
    requested_path: splitPath(req.originalUrl),
    raw_path: req.originalUrl,
  });
};

function splitPath(path) {
  return path.split("/").filter(function (part) {
    return part;
  });
}

exports.sendCouchDBResp = function (res, err, couchResp) {
  if (err) {
    return exports.sendError(res, err);
  }

  res.set(couchResp.headers);
  var body;
  if (couchResp.base64) {
    body = new Buffer(couchResp.base64, 'base64');
  } else {
    body = couchResp.body;
  }
  res.status(couchResp.code).send(body);
};

exports.sendError = function (res, err, baseStatus) {
  var status = err.status || baseStatus || 500;

  // last argument is optional
  if (err.name && err.message) {
    if (err.name === 'Error') {
      if (err.message.indexOf("Bad special document member") !== -1) {
        err.name = 'doc_validation';
      }
      // add more clauses here if the error name is too general
    }
    err = {
      error: err.name,
      reason: err.message
    };
  }
  exports.sendJSON(res, status, err);
};

exports.sendJSON = function (res, status, body) {
  res.status(status);

  var type = res.req.accepts(['text', 'json']);
  if (type === "json") {
    res.setHeader('Content-Type', 'application/json');
  } else {
    //adds ; charset=utf-8
    res.type('text/plain');
  }
  //convert to buffer so express doesn't add the ; charset=utf-8 if it
  //isn't already there by now. No performance problem: express does
  //this internally anyway.
  res.send(new Buffer(JSON.stringify(body) + "\n", 'utf8'));
};

exports.setLocation = function (res, path) {
  //CouchDB location headers are always non-relative.
  var loc = (
    res.req.protocol +
    '://' +
    ((res.req.hostname === '127.0.0.1') ?
      '' : res.req.subdomains.join('.') + '.') +
    res.req.hostname +
    ':' + res.req.socket.localPort +
    '/' + path
  );
  res.location(loc);
};

exports.restrictMethods = function (methods) {
  return function (req, res, next) {
    if (methods.indexOf(req.method) === -1) {
      res.set("Allow", methods.join(", "));
      return exports.sendJSON(res, 405, {
        error: 'method_not_allowed',
        reason: "Only " + methods.join(",") + " allowed"
      });
    }
    next();
  };
};

exports.parseRawBody = function (req, res, next) {
  // Custom bodyParsing because bodyParser chokes
  // on 'malformed' requests, and also because we need the
  // rawBody for attachments
  // Be careful not to catch normal design docs or local docs
  if (req.params.id === '_design' || req.params.id === '_local') {
    return next();
  }
  rawBody(req, {
    length: req.headers['content-length']
  }, function (err, string) {
    if (err) {
      return next(err);
    }
    req.rawBody = string;
    next();
  });
};

exports.getUsersDBName = function (config) {
  return config.get('couch_httpd_auth', 'authentication_db');
};

exports.getUsersDB = function (PouchDB, config, dbWrapper) {
  var name = exports.getUsersDBName(config);
  return dbWrapper.wrap(name, new PouchDB(name));
};
