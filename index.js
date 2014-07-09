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
var httpQuery = require("pouchdb-req-http-query");

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

exports.useAsAuthenticationDB = function (callback) {
  var db = this;

  try {
    Validation.installValidationMethods.call(db);
  } catch (err) {
    throw new Error("Already in use as an authentication database.");
  }

  dbs.push(db);
  originalMethodsByDbIdx.push({
    put: db.put.bind(db),
    post: db.post.bind(db),
    bulkDocs: db.bulkDocs.bind(db)
  });

  var newMethods = extend({}, api);
  if (!isOnlineAuthDB(db)) {
    newMethods = extend(newMethods, docApi);
  }
  for (var name in newMethods) {
    db[name] = newMethods[name].bind(db);
  }

  var promise;
  if (isOnlineAuthDB(db)) {
    promise = Promise.resolve();
  } else {
    promise = db.info()
      .then(function (info) {
        return "-session-" + info.db_name;
      })
      .then(function (sessionDBName) {
        sessionDBsByDBIdx.push(new db.constructor(sessionDBName));

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
  }

  nodify(promise, callback);
  return promise;
};

function isOnlineAuthDB(db) {
  return ["http", "https"].indexOf(db.type()) !== -1;
}

function processArgs(db, opts, callback) {
  if (typeof opts === "function") {
    callback = opts;
    opts = {};
  }
  opts.sessionID = opts.sessionID || "default";
  return {
    db: db,
    opts: opts,
    callback: callback
  };
}

var docApi = {};
var api = {};

docApi.put = function (doc, opts, callback) {
  var db = this;
  var promise = modifyDoc(doc).then(function (newDoc) {
    return originalMethodsForDB(db).put(newDoc, opts);
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
      delete doc.password;
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
        resolve(derived_key.toString("hex"));
      }
    });
  });
}

docApi.post = function (doc, opts, callback) {
  var db = this;
  var promise = modifyDoc(doc).then(function (newDoc) {
    return originalMethodsForDB(db).post(newDoc, opts);
  });
  nodify(promise, callback);
  return promise;
};

docApi.bulkDocs = function (docs, opts, callback) {
  var db = this;
  if (!Array.isArray(docs)) {
    docs = docs.docs;
  }
  var promise = Promise.all(docs.map(function (doc) {
    return modifyDoc(doc);
  })).then(function (newDocs) {
    return originalMethodsForDB(db).bulkDocs(newDocs, opts);
  });
  nodify(promise, callback);
  return promise;
};

api.signUp = function (username, password, opts, callback) {
  //opts: roles
  var args = processArgs(this, opts, callback);

  var doc = {
    _id: docId(username),
    type: 'user',
    name: username,
    password: password,
    roles: args.opts.roles || []
  };

  var promise = args.db.put(doc);
  nodify(promise, callback);
  return promise;
};

function docId(username) {
  return "org.couchdb.user:" + username;
}

api.logIn = function (username, password, opts, callback) {
  var args = processArgs(this, opts, callback);
  var promise;

  if (isOnlineAuthDB(args.db)) {
    promise = httpQuery(args.db, {
      method: "POST",
      raw_path: "/_session",
      body: JSON.stringify({
        name: username,
        password: password
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    var userDoc;
    var sessionDB = sessionDBForDB(args.db);

    promise = args.db.get(docId(username))
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
  }

  nodify(promise, args.callback);
  return promise;
};

api.logOut = function (opts, callback) {
  var args = processArgs(this, opts, callback);
  var promise;

  if (isOnlineAuthDB(args.db)) {
    promise = httpQuery(args.db, {
      method: "DELETE",
      raw_path: "/_session"
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    var sessionDB = sessionDBForDB(args.db);

    promise = sessionDB.get(args.opts.sessionID)
      .then(function (doc) {
        return sessionDB.remove(doc);
      })
      .catch(function () {
        //fine, no session means already logged out.
      })
      .then(function () {
        return {ok: true};
      });
  }
  nodify(promise, args.callback);
  return promise;
};

api.session = function (opts, callback) {
  var args = processArgs(this, opts, callback);
  var promise;
  if (isOnlineAuthDB(args.db)) {
    promise = httpQuery(args.db, {
      raw_path: "/_session",
      method: "GET",
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    var sessionDB = sessionDBForDB(args.db);
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

    promise = args.db.info()
      .then(function (info) {
        resp.info.authentication_db = info.db_name;

        return sessionDB.get(args.opts.sessionID);
      })
      .then(function (sessionDoc) {
        return args.db.get(docId(sessionDoc.username));
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
  }
  nodify(promise, args.callback);
  return promise;
};

exports.stopUsingAsAuthenticationDB = function (callback) {
  var db = this;

  var dbIdx = dbs.indexOf(db);
  if (dbIdx === -1) {
    throw new Error("Not an authentication database.");
  }
  dbs.splice(dbIdx, 1);
  var originalMethods = originalMethodsByDbIdx.splice(dbIdx, 1)[0];
  for (var name in api) {
    if (api.hasOwnProperty(name)) {
      delete db[name];
    }
  }
  extend(db, originalMethods);

  Validation.uninstallValidationMethods.call(db);

  var promise;
  if (isOnlineAuthDB(db)) {
    promise = Promise.resolve();
  } else {
    var sessionDB = sessionDBsByDBIdx.splice(dbIdx, 1)[0];

    promise = sessionDB.destroy()
      .then(function () {
        //empty success value
      });
  }
  nodify(promise, callback);
  return promise;
};
