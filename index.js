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

/*global XMLHttpRequest */

"use strict";

var Promise = require("pouchdb-promise");
var PouchPluginError = require("pouchdb-plugin-error");
var normalizeHeaderCase = require("header-case-normalizer");

if (typeof global.XMLHttpRequest === "undefined") {
  global.XMLHttpRequest = require("xhr2");
}

module.exports = function httpQuery(db, req) {
  return new Promise(function (resolve, reject) {
    function callback() {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        var err = JSON.parse(xhr.responseText);
        reject(new PouchPluginError({
          "name": err.error,
          "message": err.reason,
          "status": xhr.status
        }));
        return;
      }

      var headers = {};
      xhr.getAllResponseHeaders().split("\r\n").forEach(function (line) {
        if (line) {
          var splittedHeader = line.split(":");
          headers[normalizeHeaderCase(splittedHeader[0]).trim()] = splittedHeader[1].trim();
        }
      });
      var result = {
        body: xhr.responseText,
        headers: headers,
        code: xhr.status
      };
      if (headers["content-type"] === "application/json") {
        result.json = JSON.parse(result.body);
      }
      resolve(result);
    }

    //strips the database from the requested_path
    var relativeUrl = req.requested_path.slice(1).join("/");
    var url = db.getUrl() + relativeUrl;

    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.onreadystatechange = callback;
    xhr.open(req.method, url, true);
    for (var name in req.headers) {
      if (req.headers.hasOwnProperty(name)) {
        xhr.setRequestHeader(name, req.headers[name]);
      }
    }
    xhr.send(req.body === "undefined" ? null : req.body);
  });
};
