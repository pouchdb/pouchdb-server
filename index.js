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

//TODO: call http equivalent if http adapter

var Promise = require("lie");
var couchdb_objects = require("../couchdb-objects");
var addCallback = require("../utils/promisewrapper.js");
var coucheval = require("../utils/coucheval.js");

function doUpdating(methodName, db, query, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

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

  //get the documents involved
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.updates || {}).hasOwnProperty(updateName)) {
      throw {
        status: 404,
        error: "not_found",
        reason: "missing update function " + updateName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var docPromise = db.get(docId).catch(function () {
    //doc might not exist - that's ok and expected.
    return null;
  });

  var promise = Promise.all([reqPromise, ddocPromise, docPromise]).then(function (args) {
    var req = args[0];
    var designDoc = args[1];
    var doc = args[2];

    //run update function
    var func = coucheval.evaluate(designDoc, {}, designDoc.updates[updateName]);
    var result;
    try {
      result = func(doc, req);
    } catch (e) {
      throw coucheval.wrapExecutionError(e);
    }
    //save result if necessary
    if (result[0] !== null) {
      return db[methodName](result[0]).then(function () {
        return result[1];
      });
    }
    return result[1];
  });
  addCallback(promise, callback);
  return promise;
}

exports.updatingPut = function (query, options, callback) {
  var db = this;
  var methodName = options.withValidation ? "validatingPut" : "put";
  return doUpdating(methodName, db, query, options, callback);
};

//TODO: Shouldn't this method add an 'id' itself if not already there
//and then afterwards just call exports.updatingPut?
exports.updatingPost = function (query, options, callback) {
  var db = this;
  var methodName = options.withValidation ? "validatingPost" : "post";
  return doUpdating(methodName, db, query, options, callback);
};
