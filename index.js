/*
	Copyright 2013-2014, Marten de Vries

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

var couchdb_objects = require("couchdb-objects");
var nodify = require("promise-nodify");
var coucheval = require("couchdb-eval");
var httpQuery = require("pouchdb-req-http-query");
var completeRespObj = require("couchdb-resp-completer");

function doUpdating(method, db, query, options, callback) {
  if (["function", "undefined"].indexOf(typeof options) !== -1) {
    callback = options;
    options = {};
  }
  options.method = method;

  var designDocName = query.split("/")[0];
  var updateName = query.split("/")[1];
  var docId = query.split("/")[2];

  //build request object
  var infoPromise = db.info();
  var pathPromise = infoPromise.then(function (info) {
    var path = [info.db_name, "_design", designDocName, "_update", updateName];
    if (docId) {
      path.push(docId);
    }
    return path;
  });
  var reqPromise = couchdb_objects.buildRequestObject(options, pathPromise, infoPromise, db);
  return reqPromise.then(function (req) {
    //the only option that isn't related to the request object.
    delete req.withValidation;

    var promise;
    if (["http", "https"].indexOf(db.type()) === -1) {
      promise = offlineQuery(db, designDocName, updateName, docId, req, options);
    } else {
      promise = httpQuery(db, req);
    }

    nodify(promise, callback);
    return promise;
  });
}

function offlineQuery(db, designDocName, updateName, docId, req, options) {
  var Promise = db.constructor.utils.Promise;

  //get the documents involved
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.updates || {}).hasOwnProperty(updateName)) {
      throw {
        status: 404,
        name: "not_found",
        message: "missing update function " + updateName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var docPromise = db.get(docId).catch(function () {
    //doc might not exist - that's ok and expected.
    return null;
  });

  return Promise.all([ddocPromise, docPromise]).then(function (args) {
    var designDoc = args[0];
    var doc = args[1];

    //run update function
    var func = coucheval.evaluate(designDoc, {}, designDoc.updates[updateName]);
    var result;
    try {
      result = func.call(designDoc, doc, req);
    } catch (e) {
      throw coucheval.wrapExecutionError(e);
    }
    var savePromise;
    //save result[0] if necessary
    if (result[0] === null) {
      savePromise = Promise.resolve();
    } else {
      var methodName = options.withValidation ? "validatingPut" : "put";
      savePromise = db[methodName](result[0], options);
    }
    //then return the result
    return savePromise.then(function () {
      return completeRespObj(result[1]);
    });
  });
}

exports.updatingPut = function (query, options, callback) {
  return doUpdating("PUT", this, query, options, callback);
};

exports.updatingPost = function (query, options, callback) {
  return doUpdating("POST", this, query, options, callback);
};
