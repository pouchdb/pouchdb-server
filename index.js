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

var Promise = require("pouchdb-promise");
var crypto = require("crypto-lite").crypto;
var secureRandom = require("secure-random");
var extend = require("extend");

var wrappers = require("pouchdb-wrappers");
var createBulkDocsWrapper = require("pouchdb-bulkdocs-wrapper");
var nodify = require("promise-nodify");
var Validation = require("pouchdb-validation");
var PouchPluginError = require("pouchdb-plugin-error");
var httpQuery = require("pouchdb-req-http-query");
var systemDB = require("pouchdb-system-db");

var DESIGN_DOC = require("./designdoc.js");
var ADMIN_RE = /^-pbkdf2-([\da-f]+),([\da-f]+),([0-9]+)$/;
var IS_HASH_RE = /^-(?:pbkdf2|hashed)-/;
var SESSION_DB_NAME = 'pouch__auth_sessions__';

var sessionDB;
function getSessionDB(PouchDB) {
  if (!sessionDB) {
    sessionDB = new PouchDB(SESSION_DB_NAME, {auto_compaction: true});
  }
  return sessionDB;
}

var dbData = {
  dbs: [],
  isOnlineAuthDBsByDBIdx: []
};
function dbDataFor(db) {
  var i = dbData.dbs.indexOf(db);
  return {
    isOnlineAuthDB: dbData.isOnlineAuthDBsByDBIdx[i],
  };
}

exports.useAsAuthenticationDB = function (opts, callback) {
  var args = processArgs(this, opts, callback);

  try {
    Validation.installValidationMethods.call(args.db);
  } catch (err) {
    throw new Error("Already in use as an authentication database.");
  }

  var i = dbData.dbs.push(args.db) -1;
  if (typeof args.opts.isOnlineAuthDB === "undefined") {
    args.opts.isOnlineAuthDB = ["http", "https"].indexOf(args.db.type()) !== -1;
  }
  dbData.isOnlineAuthDBsByDBIdx[i] = args.opts.isOnlineAuthDB;

  if (!args.opts.isOnlineAuthDB) {
    wrappers.installWrapperMethods(args.db, writeWrappers);
    systemDB.installSystemDBProtection(args.db);
  }
  for (var name in api) {
    args.db[name] = api[name].bind(args.db);
  }

  var promise;
  if (args.opts.isOnlineAuthDB) {
    promise = Promise.resolve();
  } else {
    promise = args.db.put(DESIGN_DOC)
      .catch(function (err) {
        if (err.status !== 409) {
          throw err;
        }
      })
      .then(function () {/* empty success value */});
  }

  nodify(promise, args.callback);
  return promise;
};

function processArgs(db, opts, callback) {
  if (typeof opts === "function") {
    callback = opts;
    opts = {};
  }
  opts = opts || {};
  //clone (deep)
  opts = extend(true, {}, opts);

  opts.sessionID = opts.sessionID || "default";
  if (typeof opts.admins === "undefined") {
    opts.admins = {};
  } else {
    opts.admins = parseAdmins(opts.admins);
  }
  return {
    db: db,
    //|| {} for hashAdminPasswords e.g.
    PouchDB: (db || {}).constructor,
    opts: opts,
    callback: callback
  };
}

function parseAdmins(admins) {
  var result = {};
  for (var name in admins) {
    if (admins.hasOwnProperty(name)) {
      var info = admins[name].match(ADMIN_RE);
      if (info) {
        result[name] = {
          password_scheme: "pbkdf2",
          derived_key: info[1],
          salt: info[2],
          iterations: parseInt(info[3], 10),
          roles: ["_admin"],
          name: name
        };
      }
    }
  }
  return result;
}

var api = {};
var writeWrappers = {};

writeWrappers.put = function (original, args) {
  return modifyDoc(args.doc).then(original);
};
writeWrappers.post = writeWrappers.put;

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
    });
  }
  return Promise.resolve();
}

function generateSalt() {
  var arr = secureRandom(16);
  var result = arrayToString(arr);
  return Promise.resolve(result);
}

function arrayToString(array) {
  var result = "";
  for (var i = 0; i < array.length; i += 1) {
    result += ((array[i] & 0xFF) + 0x100).toString(16);
  }
  return result;
}

function hashPassword(password, salt, iterations) {
  return new Promise(function (resolve, reject) {
    crypto.pbkdf2(password, salt, iterations, 20, function (err, derived_key) {
      if (err) {
        reject(err); //coverage: ignore
      } else {
        resolve(derived_key.toString("hex"));
      }
    });
  });
}

writeWrappers.bulkDocs = createBulkDocsWrapper(modifyDoc);

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
  nodify(promise, args.callback);
  return promise;
};

function docId(username) {
  return "org.couchdb.user:" + username;
}

api.logIn = function (username, password, opts, callback) {
  var args = processArgs(this, opts, callback);
  var data = dbDataFor(args.db);
  var promise;

  if (data.isOnlineAuthDB) {
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
    var userDoc, userDocPromise;

    userDoc = args.opts.admins[username];
    if (typeof userDoc === "undefined") {
      userDocPromise = args.db.get(docId(username), {conflicts: true});
    } else {
      userDocPromise = Promise.resolve(userDoc);
    }

    promise = userDocPromise
      .then(function (doc) {
        if ((doc._conflicts || {}).length) {
          throw new PouchPluginError({
            status: 401,
            name: "unauthorized",
            message: "User document conflicts must be resolved before" +
              "the document is used for authentication purposes."
          });
        }
        userDoc = doc;
        return hashPassword(password, userDoc.salt, userDoc.iterations);
      })
      .then(function (derived_key) {
        if (derived_key !== userDoc.derived_key) {
          throw "invalid_password";
        }
        return getSessionDB(args.PouchDB).get(args.opts.sessionID).catch(function () {
          //non-existing doc is fine
          return {_id: args.opts.sessionID};
        });
      })
      .then(function (sessionDoc) {
        sessionDoc.username = userDoc.name;

        return getSessionDB(args.PouchDB).put(sessionDoc);
      })
      .then(function () {
          return {
            ok: true,
            name: userDoc.name,
            roles: userDoc.roles
          };
      })
      .catch(function (err) {
        if (!(err instanceof PouchPluginError)) {
          err = new PouchPluginError({
            status: 401,
            name: "unauthorized",
            message: "Name or password is incorrect."
          });
        }
        throw err;
      });
  }

  nodify(promise, args.callback);
  return promise;
};

api.logOut = function (opts, callback) {
  var args = processArgs(this, opts, callback);
  var data = dbDataFor(args.db);
  var promise;

  if (data.isOnlineAuthDB) {
    promise = httpQuery(args.db, {
      method: "DELETE",
      raw_path: "/_session"
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
    promise = getSessionDB(args.PouchDB).get(args.opts.sessionID)
      .then(function (doc) {
        return getSessionDB(args.PouchDB).remove(doc);
      })
      .catch(function () {/* fine, no session -> already logged out */})
      .then(function () {
        return {ok: true};
      });
  }
  nodify(promise, args.callback);
  return promise;
};

api.session = function (opts, callback) {
  var args = processArgs(this, opts, callback);
  var data = dbDataFor(args.db);

  var promise;
  if (data.isOnlineAuthDB) {
    promise = httpQuery(args.db, {
      raw_path: "/_session",
      method: "GET",
    }).then(function (resp) {
      return JSON.parse(resp.body);
    });
  } else {
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
    if (Object.keys(args.opts.admins).length === 0) {
      //admin party
      resp.userCtx.roles = ["_admin"];
    }

    promise = args.db.info()
      .then(function (info) {
        resp.info.authentication_db = info.db_name;

        return getSessionDB(args.PouchDB).get(args.opts.sessionID);
      })
      .then(function (sessionDoc) {
        var adminDoc = args.opts.admins[sessionDoc.username];
        if (typeof adminDoc !== "undefined") {
          return adminDoc;
        }
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

exports.stopUsingAsAuthenticationDB = function (opts, callback) {
  var db = this;

  var i = dbData.dbs.indexOf(db);
  if (i === -1) {
    throw new Error("Not an authentication database.");
  }
  dbData.dbs.splice(i, 1);

  for (var name in api) {
    if (api.hasOwnProperty(name)) {
      delete db[name];
    }
  }

  var isOnlineAuthDB = dbData.isOnlineAuthDBsByDBIdx.splice(i, 1)[0];
  if (!isOnlineAuthDB) {
    systemDB.uninstallSystemDBProtection(db);
    wrappers.uninstallWrapperMethods(db, writeWrappers);
  }

  Validation.uninstallValidationMethods.call(db);

  //backwards compatibility: this once contained async logic, even
  //though today it's all synchronous.
  var promise = Promise.resolve();
  nodify(promise, callback);
  return promise;
};

exports.hashAdminPasswords = function (admins, opts, callback) {
  //opts: opts.iterations (default 10)
  //'static' method (doesn't use the database)
  var args = processArgs(null, opts, callback);
  var iterations = args.opts.iterations || 10;

  var result = {};
  var promise = Promise.all(Object.keys(admins).map(function (key) {
    return hashAdminPassword(admins[key], iterations)
      .then(function (hashed) {
        result[key] = hashed;
      });
  })).then(function () {
    return result;
  });
  nodify(promise, args.callback);
  return promise;
};

function hashAdminPassword(password, iterations) {
  if (IS_HASH_RE.test(password)) {
    return Promise.resolve(password);
  }
  var salt;
  return generateSalt()
    .then(function (theSalt) {
      salt = theSalt;
      return hashPassword(password, salt, iterations);
    })
    .then(function (hash) {
      return "-pbkdf2-" + hash + "," + salt + "," + iterations;
    });
}
