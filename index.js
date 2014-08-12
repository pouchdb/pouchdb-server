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

//TODO: add access logic to all normal functions (.get, .allDocs, .put,
//.bulkDocs, .remove, .post, .info, etc.)

"use strict";

var extend = require("extend");
var nodify = require("promise-nodify");
var httpQuery = require("pouchdb-req-http-query");

var DOC_ID = "_local/_security";

exports.putSecurity = function (secObj, callback) {
  var db = this;
  var promise;

  if (isHTTP(db)) {
    promise = httpRequest(db, {
      method: "PUT",
      body: JSON.stringify(secObj)
    });
  } else {
    promise = db.get(DOC_ID)
      .catch(function () {
        return {_id: DOC_ID};
      })
      .then(function (doc) {
        doc.security = secObj;

        return db.put(doc);
      })
      .then(function () {
        return {ok: true};
      });
  }
  nodify(promise, callback);
  return promise;
};

function isHTTP(db) {
  return ["http", "https"].indexOf(db.type()) !== -1;
}

function httpRequest(db, reqStub) {
  return db.info()
    .then(function (info) {
      extend(reqStub, {
        raw_path: "/" + info.db_name + "/_security",
        headers: {
          "Content-Type": "application/json"
        }
      });
      return httpQuery(db, reqStub)
        .then(function (resp) {
          return JSON.parse(resp.body);
        });
    });
}

exports.getSecurity = function (callback) {
  var db = this;
  var promise;

  if (isHTTP(db)) {
    promise = httpRequest(db, {
      method: "GET"
    });
  } else {
    promise = db.get(DOC_ID)
      .catch(function () {
        return {security: {}};
      })
      .then(function (doc) {
        return doc.security;
      });
  }
  nodify(promise, callback);
  return promise;
};
