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

var wrappers = require('pouchdb-wrappers');
var nodify = require('promise-nodify');
var fs = require('fs');
var Promise = require('bluebird');

exports.installSizeWrapper = function () {
  var db = this;

  wrappers.installWrapperMethods(db, {
    info: function (orig, args) {
      var resp;
      return orig().then(function (info) {
        resp = info;

        return exports.getDiskSize.call(db);
      }).then(function (diskSize) {
        resp.disk_size = diskSize;

        return resp;
      }).catch(function () {
        //surpress - .info() should keep functioning if for some reason
        //it's impossible to get the disk_size.
        return resp;
      });
    }
  });
};

exports.getDiskSize = function (callback) {
  var db = this;
  var promise;

  if (db.type() === 'leveldb') {
    var prefix = db.__opts.prefix || '';
    var path = prefix + db._db_name;

    // wait until the database is ready. Necessary for at least sqldown,
    // which doesn't write anything to disk sooner.
    var dbLoaded = db.then || function (cb) {
      return cb();
    };
    promise = dbLoaded.call(db, function () {
      return getDBSize(path);
    });
  } else {
    var msg = "Can't get the database size for database type '" + db.type() + "'!";
    promise = Promise.reject(new Error(msg));
  }

  nodify(promise, callback);
  return promise;
};

function getDBSize(path) {
  var startSize;
  return getItemSize(path).then(function (size) {
    startSize = size;

    return Promise.promisify(fs.readdir)(path).catch(function () {
      // e.g. sqldown doesn't use a directory, but a file instead.
      return [];
    });
  }).then(function (files) {
    return Promise.all(files.map(function (file) {
      return getItemSize(path + "/" + file);
    }));
  }).then(function (sizes) {
    return startSize + sizes.reduce(function (a, b) {
      return a + b;
    }, 0);
  });
}

function getItemSize(path) {
  return Promise.promisify(fs.stat)(path).then(function (stat) {
    return stat.size;
  });
}
