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

//TODO: call http equivalent if http adapter.

var Promise = require("bluebird");
var extend = require("extend");

var couchdb_objects = require("../couchdb-objects");
var render = require("../utils/couchrender.js");
var addCallback = require("../utils/promisewrapper.js");

exports.list = function (listPath, options, callback) {
  var db = this;

  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  var designDocName = listPath.split("/")[0];
  var listName = listPath.split("/")[1];
  var viewName = listPath.split("/")[2];

  //build request object
  var infoPromise = db.info();
  var pathPromise = infoPromise.then(function (info) {
    var path = [info.db_name, "_design", designDocName, "_list", listName];
    if (viewName) {
      path.push(viewName);
    }
    return path;
  });
  var reqPromise = couchdb_objects.buildRequestObject(options, pathPromise, infoPromise, db);

  //get the data involved.
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.lists || {}).hasOwnProperty(listName)) {
      throw {
        status: 404,
        error: "not_found",
        reason: "missing list function " + listName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var viewPromise = db.query(designDocName + "/" + viewName, options);

  var promise = Promise.all([ddocPromise, viewPromise, reqPromise]).then(function (args) {
    var designDoc = args[0];
    var viewResp = args[1];
    var req = args[2];

    var head = {
      offset: viewResp.offset,
      total_rows: viewResp.total_rows
    };

    var respInfo;
    var chunks = [];

    var listApi = {
      getRow: function () {
        listApi.start({});
        return viewResp.rows.shift() || null;
      },
      send: function (chunk) {
        listApi.start({});
        chunks.push(chunk);
      },
      start: function (respBegin) {
        if (!respInfo) {
          respInfo = respBegin;
        }
      }
    };

    var resp = render(designDoc.lists[listName], designDoc, head, req, listApi);
    if (respInfo) {
      extend(resp, respInfo || {});
      resp.body = chunks.join("") + resp.body;
      resp.headers["Transfer-Encoding"] = "chunked";
    }
    return resp;
  });
  addCallback(promise, callback);
  return promise;
};
