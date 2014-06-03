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
      throw {status: 404, name: "rewrite_error", message:"Invalid path."};
    }
    if (!Array.isArray(rewrites)) {
      throw {status: 400, name: "rewrite_error", message: "Rewrite rules should be a JSON Array."};
    }
    var rules = rewrites.map(function (rewrite) {
      if (typeof rewrite.to === "undefined") {
        throw {status: 500, name:"error", message:"invalid_rewrite_target"};
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
    pathEnd = normalizePath(pathEnd);

    options.query = match.query;

    return couchdb_objects.buildRequestObject(db, pathEnd, options);
  });
}

function tryToFindMatch(input, rules) {
  if (arrayEquals(rules, [])) {
    throw {status: 404, name: "not_found", message: "missing"};
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

function normalizePath(path) {
  //based on path-browserify's normalizeArray function.
  //https://github.com/substack/path-browserify/blob/master/index.js#L26
  var up = 0;
  for (var i = path.length - 1; i >= 0; i--) {
    var last = path[i];
    if (last === ".") {
      path.splice(i, 1);
    } else if (last === "..") {
      path.splice(i, 1);
      up++;
    } else if (up) {
      path.splice(i, 1);
      up--;
    }
  }

  for (; up--; up) {
    path.unshift("..");
  }

  return path;
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
    if (PouchDB.allDbs && req.path[0] === "_all_dbs") {
      return PouchDB.allDbs(req.query);
    }
    if (req.path[0] === "_replicate") {
      return PouchDB.replicate(req.query);
    }
    var db = new PouchDB(decodeURIComponent(req.path[0]));
    if (req.path.length === 1) {
      if (req.method === "DELETE") {
        return db.destroy();
      } else if (req.method === "POST") {
        return callNormally(db, req, withValidation ? db.validatingPost : db.post);
      }
      return db.info();
    }
    if (req.path[1] === "_all_docs") {
      return db.allDocs(req.query);
    }
    if (req.path[1] === "_bulk_docs") {
      return db.bulkDocs(JSON.parse(req.body), req.query);
    }
    if (req.path[1] === "_changes") {
      return db.changes(req.query);
    }
    if (req.path[1] === "_compact") {
      return db.compact();
    }
    if (req.path[1] === "_design") {
      if (db.list && req.path[3] === "_list") {
        return db.list(req.path[2] + "/" + req.path.slice(4).join("/"), req);
      }
      if (req.path[3] === "_rewrite") {
        return db.rewrite(req.path[2] + "/" + req.path.slice(4).join("/"), req);
      }
      if (db.search && req.path[3] === "_search") {
        return db.search(req.path[2] + "/" + req.path.slice(4).join("/"), req.query);
      }
      if (db.show && req.path[3] === "_show") {
        return db.show(req.path[2] + "/" + req.path.slice(4).join("/"), req);
      }
      if (db.spatial && req.path[3] === "_search") {
        return db.search(req.path[2] + "/" + req.path.slice(4).join("/"), req.query);
      }
      if (db.update && req.path[3] === "_update") {
        return db.update(req.path[2] + "/" + req.path.slice(4).join("/"), req);
      }
      if (req.path[3] === "_view") {
        return db.query(req.path[2] + "/" + req.path[4], req.query);
      }
      return routeCRUD(db, "_design/" + req.path[2], req.path.slice(3), withValidation, req);
    }
    if (req.path[1] === "_local") {
      return routeCRUD(db, "_local/" + req.path[2], req.path.slice(3), withValidation, req);
    }
    if (req.path[1] === "_revs_diff") {
      return db.revsDiff(JSON.parse(req.body));
    }
    if (req.path[1] === "_temp_view") {
      return db.query(JSON.parse(req.body), req.query);
    }
    if (req.path[1] === "_view_cleanup") {
      return db.viewCleanup(req.query);
    }
    return routeCRUD(db, req.path[1], req.path.slice(2), withValidation, req);
  });
}

function callNormally(db, req, func) {
  return func.call(db, JSON.parse(req.body), req.query);
}

function routeCRUD(db, docId, remainingPath, withValidation, req) {
  function throw405() {
    throw {
      status: 405,
      name: "method_not_allowed",
      message: "method '" + req.method + "' not allowed."
    };
  }

  //document level
  if (remainingPath.length === 0) {
    return ({
      "GET": function () {
        return db.get(docId, req.query);
      },
      "PUT": callNormally.bind(null, db, req, withValidation ? db.validatingPut : db.put),
      "DELETE": callNormally.bind(null, db, req, withValidation ? db.validatingRemove : db.remove),
    }[req.method] || throw405)();
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
  throw {status: 404, name: "not_found", message: "missing"};
}

function httpRewrite(db, designDocName, rewriteUrl, options) {
  //no choice when http...
  delete options.withValidation;

  var pathEnd = ["_design", designDocName, "_rewrite"];
  pathEnd.push.apply(pathEnd, rewriteUrl);
  var reqPromise = couchdb_objects.buildRequestObject(db, pathEnd, options);
  return reqPromise.then(httpQuery.bind(null, db));
}
