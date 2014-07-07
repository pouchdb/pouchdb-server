/*
	Copyright 2014, Marten de Vries

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.or6g/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

"use strict";

var Promise = require("pouchdb-promise");
var crypto = require("crypto");
var extend = require("extend");

var nodify = require("promise-nodify");
var Validation = require("pouchdb-validation");
var PouchPluginError = require("pouchdb-plugin-error");

//to update: http://localhost:5984/_users/_design/_auth & remove _rev.
var DESIGN_DOC = require("./designdoc.js");

var dbs = [];
var originalMethodsByDbIdx = [];
var sessionDBsByDBIdx = [];

function originalMethodsForDB(db) {
  return originalMethodsByDbIdx[dbs.indexOf(db)];
}

function sessionDBForDB(db) {
  return sessionDBsByDBIdx[dbs.indexOf(db)];
}

exports.installAuthMethods = function (callback) {
  var db = this;

  Validation.installValidationMethods.call(db);

  dbs.push(db);
  originalMethodsByDbIdx.push({
    put: db.put.bind(db),
    post: db.post.bind(db),
    bulkDocs: db.bulkDocs.bind(db)
  });

  for (var name in api) {
    db[name] = api[name].bind(db);
  }

  var promise = db.info()
    .then(function (info) {
      return "-session-" + info.db_name;
    })
    .then(db.registerDependentDatabase)
    .then(function (db) {
      sessionDBsByDBIdx.push(db);

      return db.put(DESIGN_DOC);
    })
    .catch(function (err) {
      if (err.status !== 409) {
        throw err;
      }
    })
    .then(function () {
      //empty success value
    });

  nodify(promise, callback);
  return promise;
};

var api = {};

api.put = function (doc, opts, callback) {
  var promise = modifyDoc(doc).then(function (newDoc) {
    return originalMethodsForDB(this).put(newDoc, opts);
  });
  nodify(promise, callback);
  return promise;
};

function modifyDoc(doc) {
  if (!(typeof doc.password == "undefined" || doc.password === null)) {
    doc.iterations = 10;
    doc.password_scheme = "pbkdf2";

    return generateSalt().then(function (salt) {
      doc.salt = salt;

      return hashPassword(doc.password, doc.salt, doc.iterations);
    }).then(function (hash) {
      doc.derived_key = hash;

      return doc;
    });
  }
  return Promise.resolve(doc);
}

function generateSalt() {
  return new Promise(function (resolve, reject) {
    crypto.randomBytes(16, function (err, buf) {
      if (err) {
        reject(err);
      } else {
        resolve(buf.toString("hex"));
      }
    });
  });
}

function hashPassword(password, salt, iterations) {
  return new Promise(function (resolve, reject) {
    crypto.pbkdf2(password, salt, iterations, 20, function (err, derived_key) {
      if (err) {
        reject(err);
      } else {
        resolve(derived_key);
      }
    });
  });
}

api.post = function (doc, opts, callback) {
  var promise = modifyDoc(doc).then(function (newDoc) {
    return originalMethodsForDB(this).post(newDoc, opts);
  });
  nodify(promise, callback);
  return promise;
};

api.bulkDocs = function (docs, opts, callback) {
  if (!Array.isArray(docs)) {
    docs = docs.docs;
  }
  var promise = Promise.all(docs.map(function (doc) {
    return modifyDoc(doc);
  })).then(function (newDocs) {
    return originalMethodsForDB(this).bulkDocs(newDocs, opts);
  });
  nodify(promise, callback);
  return promise;
};

api.signUp = function (username, password, opts, callback) {
  //opts: roles
  var db = this;

  var doc = {
    _id: docId(username),
    type: 'user',
    name: username,
    password: password,
    roles: opts.roles || []
  };

  var promise = db.put(doc);
  nodify(promise, callback);
  return promise;
};

function docId(username) {
  return "org.couchdb.user:" + username;
}

api.logIn = function (username, password, opts, callback) {
  var userDoc;
  var db = this;
  var sessionDB = sessionDBForDB(db);
  var args = processArgs(opts, callback);

  var promise = db.get(docId(username))
    .then(function (doc) {
      userDoc = doc;
      return hashPassword(password, userDoc.salt, userDoc.iterations);
    })
    .then(function (derived_key) {
      if (derived_key !== userDoc.derived_key) {
        throw "invalid_password";
      }
      return sessionDB.get(args.opts.sessionID).catch(function () {
        //non-existing doc is fine
        return {_id: args.opts.sessionID};
      });
    })
    .then(function (sessionDoc) {
      sessionDoc.username = userDoc.name;

      return sessionDB.put(sessionDoc);
    })
    .then(function () {
        return {
          ok: true,
          name: userDoc.name,
          roles: userDoc.roles
        };
    })
    .catch(function () {
      throw new PouchPluginError({
        status: 401,
        name: "unauthorized",
        message: "Name or password is incorrect."
      });
    });

  nodify(promise, args.callback);
  return promise;
};

function processArgs(opts, callback) {
  if (typeof opts === "function") {
    callback = opts;
    opts = {};
  }
  opts.sessionID = opts.sessionID || "default";
  return {
    opts: opts,
    callback: callback
  };
}

api.logOut = function (opts, callback) {
  var db = this;
  var args = processArgs(opts, callback);
  var sessionDB = sessionDBForDB(db);

  var promise = sessionDB.get(args.opts.sesssionID)
    .then(function (doc) {
      return sessionDB.remove(doc);
    })
    .catch(function () {
      //fine, no session means already logged out.
    })
    .then(function () {
      return {ok: true};
    });
  nodify(promise, args.callback);
  return promise;
};

api.session = function (opts, callback) {
  var db = this;
  var args = processArgs(opts, callback);
  var sessionDB = sessionDBForDB(db);
  var resp = {
    ok: true,
    userCtx: {
      name: null,
      roles: [],
    },
    info: {
      authentication_handlers: ["api"]
    }
  };

  var promise = db.info()
    .then(function (info) {
      resp.info.authentication_db = info.db_name;

      return sessionDB.get(args.opts.sesssionID);
    })
    .then(function (sessionDoc) {
      return db.get(docId(sessionDoc.username));
    })
    .then(function (userDoc) {
      resp.info.authenticated = "api";
      resp.userCtx.name = userDoc.name;
      resp.userCtx.roles = userDoc.roles;
    }).catch(function () {
      //resp is valid in its current state for an error, so do nothing
    }).then(function () {
      return resp;
    });
  nodify(promise, args.callback);
  return promise;
};

exports.uninstallAuthMethods = function (callback) {
  var db = this;

  var dbIdx = dbs.indexOf(db);
  dbs.splice(dbIdx, 1);
  var originalMethods = originalMethodsByDbIdx.splice(dbIdx, 1)[0];
  var sessionDB = sessionDBsByDBIdx.splice(dbIdx, 1)[0];

  for (var name in api) {
    if (api.hasOwnProperty(name)) {
      delete db[name];
    }
  }
  extend(db, originalMethods);

  Validation.uninstallValidationMethods.call(db);

  var promise = sessionDB.destroy()
    .then(function () {
      //empty success value
    });
  nodify(promise, callback);
  return promise;
};
