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

var extend = require("extend");
var nodify = require("promise-nodify");

var couchdb_objects = require("couchdb-objects");
var render = require("couchdb-render");
var httpQuery = require("couchdb-req-http-query");

exports.list = function (listPath, options, callback) {
  //options: values to end up in the request object of the list
  //function (next to their defaults).
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
  return reqPromise.then(function (req) {
    var promise;
    if (["http", "https"].indexOf(db.type()) === -1) {
      promise = offlineQuery(db, designDocName, listName, viewName, req, options);
    } else {
      promise = httpQuery(db, req);
    }
    nodify(promise, callback);
    return promise;
  });
};

function offlineQuery(db, designDocName, listName, viewName, req, options) {
  var Promise = db.constructor.utils.Promise;

  if (req.headers["Content-Type"] && req.headers["Content-Type"] !== "application/json") {
    return Promise.reject({
      status: 400,
      name: "bad_request",
      message: "invalid_json"
    });
  }

  //get the data involved.
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.lists || {}).hasOwnProperty(listName)) {
      throw {
        status: 404,
        name: "not_found",
        message: "missing list function " + listName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var viewPromise = db.query(designDocName + "/" + viewName, options);

  return Promise.all([ddocPromise, viewPromise]).then(function (args) {
    var designDoc = args[0];
    var viewResp = args[1];

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
      extend(resp, respInfo);
      resp.body = chunks.join("") + resp.body;
      resp.headers["Transfer-Encoding"] = "chunked";
    }
    return resp;
  });
}
