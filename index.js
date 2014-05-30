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

"use strict";

module.exports = function httpQuery(db, req) {
  var ajax = db.constructor.utils.ajax;
  var Promise = db.constructor.utils.Promise;

  return new Promise(function (resolve, reject) {
    function callback(err, body, xhr) {
      if (err) {
        reject(err);
        return;
      }
      var headers = {};
      xhr.getAllResponseHeaders().split("\r\n").forEach(function (line) {
        if (line) {
          headers[line.split(":")[0]] = line.split(":")[1].trim();
        }
      });
      var result = {
        body: xhr.responseText,
        headers: headers,
        code: xhr.status
      };
      if (headers["Content-Type"] === "application/json") {
        result.json = JSON.parse(result.body);
      }
      resolve(result);
    }

    //strips the database from the requested_path
    var relativeUrl = req.requested_path.slice(1).join("/");
    ajax({
      method: req.method,
      url: db.getUrl() + relativeUrl,
      headers: req.headers,
      body: req.body === "undefined" ? null : req.body,
      cache: true,
      processData: false,
      json: false
    }, callback);
  });
};
