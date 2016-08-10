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
var Promise = require("pouchdb-promise");

var couchdb_objects = require("couchdb-objects");
var render = require("couchdb-render");
var httpQuery = require("pouchdb-req-http-query");
var PouchPluginError = require("pouchdb-plugin-error");

exports.list = function (listPath, options, callback) {
  //options: values to end up in the request object of the list
  //function (next to their defaults).
  var db = this;

  if (["function", "undefined"].indexOf(typeof options) !== -1) {
    callback = options;
    options = {};
  }
  var listPathElems = listPath.split("/");
  var listDDocName = listPathElems[0];
  var listName = listPathElems[1];
  var viewName, viewDDocName;
  if (listPathElems.length === 3) {
    viewDDocName = listDDocName;
    viewName = listPathElems[2];
  } else {
    viewDDocName = listPathElems[2];
    viewName = listPathElems[3];
  }

  //build request object
  var pathEnd = ["_design", listDDocName, "_list", listName];
  if (viewDDocName !== listDDocName) {
    pathEnd.push(viewDDocName);
  }
  if (viewName) {
    pathEnd.push(viewName);
  }
  var reqPromise = couchdb_objects.buildRequestObject(db, pathEnd, options);
  var promise = reqPromise.then(function (req) {
    if (["http", "https"].indexOf(db.type()) === -1) {
      return offlineQuery(db, listDDocName, listName, viewDDocName, viewName, req, options);
    } else {
      return httpQuery(db, req);
    }
  });
  nodify(promise, callback);
  return promise;
};

function offlineQuery(db, listDDocName, listName, viewDDocName, viewName, req, options) {
  var notJSON = req.headers["Content-Type"] && req.headers["Content-Type"] !== "application/json";
  var hasBody = req.body && req.body !== "undefined";
  if (notJSON && hasBody) {
    return Promise.reject(new PouchPluginError({
      status: 400,
      name: "bad_request",
      message: "invalid_json"
    }));
  }

  //get the data involved.
  var ddocPromise = db.get("_design/" + listDDocName).then(function (designDoc) {
    if (!(designDoc.lists || {}).hasOwnProperty(listName)) {
      throw new PouchPluginError({
        status: 404,
        name: "not_found",
        message: "missing list function " + listName + " on design doc _design/" + listDDocName
      });
    }
    return designDoc;
  });
  var viewOpts = extend({}, options.query);
  if (req.method !== 'GET') {
    extend(viewOpts, options.json);
  }
  var viewPromise = db.query(viewDDocName + "/" + viewName, viewOpts);

  //not Promise.all because the error order matters.
  var args = [];
  return viewPromise.then(function (viewResp) {
    args.push(viewResp);

    return db.info();
  }).then(function (info) {
    args.push(info);

    return ddocPromise;
  }).then(function (ddoc) {
    args.push(ddoc);

    return args;

  }).then(Function.prototype.apply.bind(function (viewResp, info, designDoc) {
    var head = {
      offset: viewResp.offset,
      total_rows: viewResp.total_rows,
      update_seq: info.update_seq
    };

    var respInfo;
    var chunks = [];

    var listApi = {
      getRow: function () {
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
  }, null));
}
