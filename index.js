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
var render = require("couchdb-render");
var nodify = require("promise-nodify");
var httpQuery = require("pouchdb-req-http-query");

exports.show = function (showPath, options, callback) {
  //options: values to end up in the request object of the show
  //function (next to their defaults).

  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  var db = this;

  var splitted = showPath.split("/");
  var designDocName = splitted[0];
  var showName = splitted[1];
  var docId = splitted[2];
  if (docId === "_design" && splitted.length > 3) {
    docId += "/" + splitted[3];
  }

  //build request object
  var infoPromise = db.info();
  var pathPromise = infoPromise.then(function (info) {
    var path = [info.db_name, "_design", designDocName, "_show", showName];
    if (docId) {
      path.push.apply(path, docId.split("/"));
    }
    return path;
  });
  var reqPromise = couchdb_objects.buildRequestObject(options, pathPromise, infoPromise, db);
  return reqPromise.then(function (req) {
    var promise;
    if (["http", "https"].indexOf(db.type()) === -1) {
      promise = offlineQuery(db, designDocName, showName, docId, req, options);
    } else {
      promise = httpQuery(db, req);
    }
    nodify(promise, callback);
    return promise;
  });
};

function offlineQuery(db, designDocName, showName, docId, req, options) {
  var Promise = db.constructor.utils.Promise;

  //get the documents involved.
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.shows || {}).hasOwnProperty(showName)) {
      throw {
        status: 404,
        name: "not_found",
        message: "missing show function " + showName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var docPromise = db.get(docId, options).catch(function () {
    //doc might not exist - that's ok and expected.
    return null;
  });
  return Promise.all([ddocPromise, docPromise]).then(function (args) {
    //all data collected - do the magic that is a show function
    var designDoc = args[0];
    var doc = args[1];

    var source = designDoc.shows[showName];

    return render(source, designDoc, doc, req);
  });
}
