/*
  Copyright 2014, Marten de Vries

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

"use strict";

var PouchPluginError = require("pouchdb-plugin-error");
var extend = require("extend");
var querystring = require("querystring");

module.exports = function route(PouchDB, req, options) {
  //Mapping urls to PouchDB/plug-in functions. Based on:
  //http://docs.couchdb.org/en/latest/http-api.html
  if (req.path[0] === "..") {
    throw404(); //coverage: ignore
  }
  if (req.query) {
    for (var key in req.query) {
      if (Object.hasOwnProperty.call(req.query, key)) {
        try {
          req.query[key] = JSON.parse(req.query[key]);
        } catch (e) {
          //don't replace the original value
        }
      }
    }
  }
  var rootFunc = {
    "_all_dbs": (PouchDB.allDbs || throw404).bind(PouchDB),
    "_replicate": callWithBody.bind(null, PouchDB, req, function (body) {
      return this.replicate(body.source, body.target, body);
    }),
    "_session": function () {
      if (!PouchDB.seamlessSession) {
        throw404();
      }
      return ({
        GET: PouchDB.seamlessSession.bind(PouchDB),
        POST: function () {
          var data = parseBody(req);
          return PouchDB.seamlessLogIn(data.name, data.password);
        },
        DELETE: PouchDB.seamlessLogOut.bind(PouchDB)
      }[req.method] || throw405.bind(null, req))();
    }
  }[req.path[0]];
  if (rootFunc) {
    return rootFunc();
  }
  var db = new PouchDB(decodeURIComponent(req.path[0]));
  var localCallWithBody = callWithBody.bind(null, db, req);
  if (req.path.length === 1) {
    var post = options.withValidation ? db.validatingPost : db.post;
    var defaultDBFunc = db.info.bind(db);
    return ({
      DELETE: db.destroy.bind(db),
      POST: localCallWithBody.bind(null, post, crudOpts(req, options))
    }[req.method] || defaultDBFunc)();
  }

  var localRouteCRUD = routeCRUD.bind(null, db, req, options);
  var defaultFunc = localRouteCRUD.bind(null, req.path[1], req.path.slice(2));
  var bulkDocs = options.withValidation ? db.validatingBulkDocs : db.bulkDocs;
  return ({
    "_all_docs": db.allDocs.bind(db, req.query),
    "_bulk_docs": localCallWithBody.bind(null, bulkDocs, crudOpts(req, options)),
    "_changes": db.changes.bind(db, req.query),
    "_compact": db.compact.bind(db),
    "_design": function () {
      var url = req.path[2] + "/" + req.path.slice(4).join("/");
      var subDefaultFunc = localRouteCRUD.bind(null, "_design/" + req.path[2], req.path.slice(3));
      return ({
        "_list": (db.list || throw404).bind(db, url, req),
        "_rewrite": function () {
          var newReq = extend({}, req);
          delete newReq.path;
          return (db.rewrite || throw404).bind(db, url, newReq)();
        },
        "_search": (db.search || throw404).bind(db, url, req.query),
        "_show": (db.show || throw404).bind(db, url, req),
        "_spatial": (db.spatial || throw404).bind(db, url, req.query),
        "_update": (db.update || throw404).bind(db, url, req),
        "_view": db.query.bind(db, url, req.query)
      }[req.path[3]] || subDefaultFunc)();
    },
    "_local": localRouteCRUD.bind(null, "_local/" + req.path[2], req.path.slice(3)),
    "_revs_diff": localCallWithBody.bind(null, db.revsDiff),
    "_security": function () {
      return ({
        GET: localCallWithBody.bind(null, db.getSecurity),
        PUT: localCallWithBody.bind(null, db.putSecurity)
      }[req.method] || throw405.bind(null, req))();
    },
    "_temp_view": localCallWithBody.bind(null, db.query, req.query),
    "_view_cleanup": db.viewCleanup.bind(db, req.query)
  }[req.path[1]] || defaultFunc)();
};

function crudOpts(req, options) {
  return extend({}, req.query, options);
}

function callWithBody(thisObj, req, func) {
  var args = Array.prototype.slice.call(arguments, 3);
  args.unshift(parseBody(req));
  return func.apply(thisObj, args);
}

function parseBody(req) {
  try {
    return JSON.parse(req.body);
  } catch (err) {
    return querystring.parse(req.body);
  }
}

function routeCRUD(db, req, options, docId, remainingPath) {
  var opts = crudOpts(req, options);
  docId = decodeURIComponent(docId);
  function callAttachment(isPut) {
    var funcs;
    var args = [docId, remainingPath[0], req.query.rev];
    if (isPut) {
      args.push(req.body);
      args.push(req.headers["Content-Type"]);

      funcs = {
        true: db.validatingPutAttachment,
        false: db.putAttachment
      };
    } else {
      funcs = {
        true: db.validatingRemoveAttachment,
        false: db.removeAttachment
      };
    }
    if (options.withValidation) {
      args.push(opts);
    }
    return funcs[options.withValidation].apply(db, args);
  }

  //document level
  if (remainingPath.length === 0) {
    var localCallWithBody = callWithBody.bind(null, db, req);
    var put = options.withValidation ? db.validatingPut : db.put;
    var remove = options.withValidation ? db.validatingRemove : db.remove;
    return ({
      GET: function () {
        return db.get(docId, opts);
      },
      PUT: localCallWithBody.bind(null, put, opts),
      DELETE: remove.bind(db, docId, opts.rev)
    }[req.method] || throw405.bind(null, req))();
  }
  //attachment level
  return ({
    GET: function () {
      return db.getAttachment(docId, remainingPath.join("/"), opts);
    },
    PUT: callAttachment.bind(null, true),
    DELETE: callAttachment.bind(null, false),

  }[req.method] || throw405.bind(null, req))();
}

function throw404() {
  throw new PouchPluginError({status: 404, name: "not_found", message: "missing"});
}

function throw405(req) {
  throw new PouchPluginError({
    status: 405,
    name: "method_not_allowed",
    message: "method '" + req.method + "' not allowed."
  });
}
