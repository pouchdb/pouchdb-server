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

/*
  Nice extras/TODO:

  - secure_rewrite; false by default is ok, but it might be nice to be
    able to set it to true as an option.
  - set x-couchdb-requested-path header in the request object.
  - loop protection.

  Tests for all those can be found in the final part of the CouchDB
  rewrite tests, which haven't (yet) been ported to Python/this plug-in.
*/

"use strict";

var couchdb_objects = require("couchdb-objects");
var nodify = require("promise-nodify");
var httpQuery = require("pouchdb-req-http-query");
var extend = require("extend");
var PouchPluginError = require("pouchdb-plugin-error");

exports.rewriteResultRequestObject = function (rewritePath, options, callback) {
  var args = parseArgs(this, rewritePath, options, callback);
  var p = buildRewriteResultReqObj(args.db, args.designDocName, args.rewriteUrl, args.options);
  nodify(p, callback);
  return p;
};

function parseArgs(db, rewritePath, options, callback) {
  if (["function", "undefined"].indexOf(typeof options) !== -1) {
    callback = options;
    options = {};
  }
  return {
    db: db,
    callback: callback,
    options: options,
    designDocName: splitUrl(rewritePath)[0],
    rewriteUrl: splitUrl(rewritePath).slice(1),
  };
}

function splitUrl(url) {
  return url.split("/").filter(function (part) {
    return part;
  });
}

function buildRewriteResultReqObj(db, designDocName, rewriteUrl, options) {
  return db.get("_design/" + designDocName).then(function (ddoc) {
    //rewrite algorithm source:
    //https://github.com/apache/couchdb/blob/master/src/couchdb/couch_httpd_rewrite.erl
    var rewrites = ddoc.rewrites;
    if (typeof rewrites === "undefined") {
      throw new PouchPluginError({
        status: 404,
        name: "rewrite_error",
        message:"Invalid path."
      });
    }
    if (!Array.isArray(rewrites)) {
      throw new PouchPluginError({
        status: 400,
        name: "rewrite_error",
        message: "Rewrite rules should be a JSON Array."
      });
    }
    var rules = rewrites.map(function (rewrite) {
      if (typeof rewrite.to === "undefined") {
        throw new PouchPluginError({
          status: 500,
          name:"error",
          message:"invalid_rewrite_target"
        });
      }
      return {
        method: rewrite.method || "*",
        from: splitUrl(rewrite.from || "*"),
        to: splitUrl(rewrite.to),
        query: rewrite.query || {}
      };
    });
    var match = tryToFindMatch({
      method: options.method || "GET",
      url: rewriteUrl,
      query: options.query || {}
    }, rules);

    var pathEnd = ["_design", designDocName];
    pathEnd.push.apply(pathEnd, match.url);

    options.query = match.query;

    return couchdb_objects.buildRequestObject(db, pathEnd, options);
  });
}

function tryToFindMatch(input, rules) {
  if (arrayEquals(rules, [])) {
    throw404();
  }
  var bindings = {};
  if (methodMatch(rules[0].method, input.method)) {
    var match = pathMatch(rules[0].from, input.url, bindings);
    if (match.ok) {
      var allBindings = extend(bindings, input.query);

      var url = [];
      url.push.apply(url, replacePathBindings(rules[0].to, allBindings));
      url.push.apply(url, match.remaining);

      var ruleQueryArgs = replaceQueryBindings(rules[0].query, allBindings);
      var query = extend(allBindings, ruleQueryArgs);
      delete query["*"];

      return {
        url: url,
        query: query
      };
    } else {
      return tryToFindMatch(input, rules.slice(1));
    }
  } else {
    return tryToFindMatch(input, rules.slice(1));
  }
}

function throw404() {
  throw new PouchPluginError({status: 404, name: "not_found", message: "missing"});
}

function arrayEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function methodMatch(required, given) {
  //corresponds to bind_method in the couchdb code
  return required === "*" || required === given;
}

function pathMatch(required, given, bindings) {
  //corresponds to bind_path in the couchdb code
  if (arrayEquals(required, []) && arrayEquals(given, [])) {
    return {ok: true, remaining: []};
  }
  if (arrayEquals(required, ["*"])) {
    bindings["*"] = given[0];
    return {ok: true, remaining: given.slice(1)};
  }
  if (arrayEquals(given, [])) {
    return {ok: false};
  }
  if ((required[0] || "")[0] === ":") {
    bindings[required[0].slice(1)] = given[0];
    return pathMatch(required.slice(1), given.slice(1), bindings);
  }
  if (required[0] === given[0]) {
    return pathMatch(required.slice(1), given.slice(1), bindings);
  }
  return {ok: false};
}

function replacePathBindings(path, bindings) {
  for (var i = 0; i < path.length; i += 1) {
    if (typeof path[i] !== "string") {
      continue;
    }
    var bindingName = path[i];
    if (bindingName[0] === ":") {
      bindingName = bindingName.slice(1);
    }
    if (bindings.hasOwnProperty(bindingName)) {
      path[i] = bindings[bindingName];
    }
  }
  return path;
}

function replaceQueryBindings(query, bindings) {
  for (var key in query) {
    if (!query.hasOwnProperty(key)) {
      continue;
    }
    if (typeof query[key] === "object") {
      query[key] = replaceQueryBindings(query[key], bindings);
    } else if (typeof query[key] === "string") {
      var bindingKey = query[key];
      if (bindingKey[0] === ":") {
        bindingKey = bindingKey.slice(1);
      }
      if (bindings.hasOwnProperty(bindingKey)) {
        var val = bindings[bindingKey];
        try {
          val = JSON.parse(val);
        } catch (e) {}
        query[key] = val;
      }
    }
  }
  return query;
}

exports.rewrite = function (rewritePath, options, callback) {
  //options: values to end up in the request object that's used to call
  //the rewrite destination (next to their defaults).

  var args = parseArgs(this, rewritePath, options, callback);

  var promise;
  if (["http", "https"].indexOf(args.db.type()) === -1) {
    promise = offlineRewrite(args.db, args.designDocName, args.rewriteUrl, args.options);
  } else {
    promise = httpRewrite(args.db, args.designDocName, args.rewriteUrl, args.options);
  }
  nodify(promise, args.callback);
  return promise;
};

function offlineRewrite(currentDb, designDocName, rewriteUrl, options) {
  var PouchDB = currentDb.constructor;

  var withValidation = options.withValidation;
  delete options.withValidation;

  var resultReqPromise = buildRewriteResultReqObj(currentDb, designDocName, rewriteUrl, options);
  return resultReqPromise.then(function (req) {
    //Mapping urls to PouchDB/plug-in functions. Based on:
    //http://docs.couchdb.org/en/latest/http-api.html
    if (req.path[0] === "..") {
      throw404();
    }
    var rootFunc = {
      "_all_dbs": (PouchDB.allDbs || throw404).bind(PouchDB),
      "_replicate": PouchDB.replicate.bind(PouchDB, req.query)
    }[req.path[0]];
    if (rootFunc) {
      return rootFunc();
    }
    var db = new PouchDB(decodeURIComponent(req.path[0]));
    var localCallWithBody = callWithBody.bind(null, db, req);
    if (req.path.length === 1) {
      var post = withValidation ? db.validatingPost : db.post;
      var defaultDBFunc = db.info.bind(db);
      return ({
        "DELETE": db.destroy.bind(db),
        "POST": localCallWithBody.bind(null, post, req.query)
      }[req.method] || defaultDBFunc)();
    }

    var localRouteCRUD = routeCRUD.bind(null, db, withValidation, req);
    var defaultFunc = localRouteCRUD.bind(null, req.path[1], req.path.slice(2));
    return ({
      "_all_docs": db.allDocs.bind(db, req.query),
      "_bulk_docs": localCallWithBody.bind(null, db.bulkDocs, req.query),
      "_changes": db.changes.bind(db, req.query),
      "_compact": db.compact.bind(db),
      "_design": function () {
        var url = req.path[2] + "/" + req.path.slice(4).join("/");
        var subDefaultFunc = localRouteCRUD.bind(null, "_design/" + req.path[2], req.path.slice(3));
        return ({
          "_list": (db.list || throw404).bind(db, url, req),
          "_rewrite": (db.rewrite || throw404).bind(db, url, req),
          "_search": (db.search || throw404).bind(db, url, req.query),
          "_show": (db.show || throw404).bind(db, url, req),
          "_spatial": (db.spatial || throw404).bind(db, url, req.query),
          "_update": (db.update || throw404).bind(db, url, req),
          "_view": db.query.bind(db, url, req.query)
        }[req.path[3]] || subDefaultFunc)();
      },
      "_local": localRouteCRUD.bind(null, "_local/" + req.path[2], req.path.slice(3)),
      "_revs_diff": localCallWithBody.bind(null, db.revsDiff),
      "_temp_view": localCallWithBody.bind(null, db.query, req.query),
      "_view_cleanup": db.viewCleanup.bind(db, req.query)
    }[req.path[1]] || defaultFunc)();
  });
}

function callWithBody(db, req, func) {
  var args = Array.prototype.slice.call(arguments, 3);
  args.unshift(JSON.parse(req.body));
  return func.apply(db, args);
}

function routeCRUD(db, withValidation, req, docId, remainingPath) {
  function throw405() {
    throw new PouchPluginError({
      status: 405,
      name: "method_not_allowed",
      message: "method '" + req.method + "' not allowed."
    });
  }
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
    if (withValidation) {
      args.push(req.query);
    }
    return funcs[withValidation].apply(db, args);
  }

  //document level
  if (remainingPath.length === 0) {
    var localCallWithBody = callWithBody.bind(null, db, req);
    var put = withValidation ? db.validatingPut : db.put;
    var remove = withValidation ? db.validatingRemove : db.remove;
    return ({
      "GET": function () {
        return db.get(docId, req.query);
      },
      "PUT": localCallWithBody.bind(null, put, req.query),
      "DELETE": localCallWithBody.bind(null, remove, req.query)
    }[req.method] || throw405)();
  }
  //attachment level
  if (remainingPath.length === 1) {
    return ({
      "GET": function () {
        return db.getAttachment(docId, remainingPath[0], req.query);
      },
      "PUT": callAttachment.bind(null, true),
      "DELETE": callAttachment.bind(null, false),

    }[req.method] || throw405)();
  }
  //not document & not attachment level
  throw404();
}

function httpRewrite(db, designDocName, rewriteUrl, options) {
  //no choice when http...
  delete options.withValidation;

  var pathEnd = ["_design", designDocName, "_rewrite"];
  pathEnd.push.apply(pathEnd, rewriteUrl);
  var reqPromise = couchdb_objects.buildRequestObject(db, pathEnd, options);
  return reqPromise.then(httpQuery.bind(null, db));
}
