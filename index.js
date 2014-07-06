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

var coucheval = require("couchdb-eval");
var couchdb_objects = require("couchdb-objects");
var nodify = require("promise-nodify");

var uuid = require("node-uuid");
var Promise = require("pouchdb-promise");
var PouchPluginError = require("pouchdb-plugin-error");

var dbs = [];
var methodNames = ["put", "post", "remove", "bulkDocs", "putAttachment", "removeAttachment"];
var methodsByDbsIdx = [];

function methods(db) {
  var index = dbs.indexOf(db);
  if (index === -1) {
    return methodsFromDb(db);
  }
  return methodsByDbsIdx[index];
}

function methodsFromDb(db) {
  var meths = {};
  methodNames.forEach(function (name) {
    meths[name] = db[name].bind(db);
  });
  return meths;
}

function oldDoc(db, id) {
  return db.get(id, {revs: true}).catch(function () {
    return null;
  });
}

function validate(validationFuncs, newDoc, oldDoc, options) {
  newDoc._revisions = (oldDoc || {})._revisions;

  try {
    validationFuncs.forEach(function (validationFuncInfo) {
      var func = validationFuncInfo.func;
      var designDoc = validationFuncInfo.designDoc;
      func.call(designDoc, newDoc, oldDoc, options.userCtx, options.secObj);
    });
  } catch (e) {
    if (typeof e.unauthorized !== "undefined") {
      throw new PouchPluginError({
        name: "unauthorized",
        message: e.unauthorized,
        status: 401
      });
    } else if (typeof e.forbidden !== "undefined") {
      throw new PouchPluginError({
        name: "forbidden",
        message: e.forbidden,
        status: 403
      });
    } else {
      throw coucheval.wrapExecutionError(e);
    }
  }
  //passed all validation functions (no errors thrown) -> success
}

function doValidation(db, newDoc, options, callback) {
  var isHttp = ["http", "https"].indexOf(db.type()) !== -1;
  if (isHttp && !(options || {}).checkHttp) {
    //CouchDB does the checking for itself. Validate succesful.
    return Promise.resolve();
  }
  if ((newDoc._id || "").indexOf("_design/") === 0) {
    //a design document -> always validates succesful.
    return Promise.resolve();
  }
  return getValidationFunctions(db).then(function (validationFuncs) {
    if (!validationFuncs.length) {
      //no validation functions, so valid!
      return;
    }
    var completeOptionsPromise = completeValidationOptions(db, options);
    var oldDocPromise = oldDoc(db, newDoc._id);

    return Promise.all([completeOptionsPromise, oldDocPromise]).then(function (args) {
      var completeOptions = args[0];
      var oldDoc = args[1];
      return validate(validationFuncs, newDoc, oldDoc, completeOptions);
    });
  });
}

function completeValidationOptions(db, options) {
  if (!options) {
    options = {};
  }
  if (!options.secObj) {
    options.secObj = {};
  }

  var userCtxPromise;
  if (options.userCtx) {
    userCtxPromise = Promise.resolve(options.userCtx);
  } else {
    var buildUserContext = couchdb_objects.buildUserContextObject;
    userCtxPromise = db.info().then(buildUserContext);
  }
  return userCtxPromise.then(function (userCtx) {
    options.userCtx = userCtx;
    return options;
  });
}

function getValidationFunctions(db, callback) {
  return db.allDocs({
    startkey: "_design/",
    endkey: "_design0",
    include_docs: true
  }).then(parseValidationFunctions);
}

function parseValidationFunctions(resp) {
  var validationFuncs = resp.rows.map(function (row) {
    return {
      designDoc: row.doc,
      code: row.doc.validate_doc_update
    };
  });
  validationFuncs = validationFuncs.filter(function (info) {
    return typeof info.code !== "undefined";
  });
  validationFuncs.forEach(function (info) {
    //convert str -> function
    info.func = coucheval.evaluate(info.designDoc, {}, info.code);
  });
  return validationFuncs;
}

function processArgs(db, callback, options) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return {
    db: db,
    callback: callback,
    options: options
  };
}

exports.validatingPut = function (doc, options, callback) {
  var args = processArgs(this, callback, options);
  var promise = doValidation(args.db, doc, args.options).then(function () {
    return methods(args.db).put(doc, args.options);
  });
  nodify(promise, callback);
  return promise;
};

exports.validatingPost = function (doc, options, callback) {
  var args = processArgs(this, callback, options);

  doc._id = doc._id || uuid.v4();
  var promise = doValidation(args.db, doc, args.options).then(function () {
    return methods(args.db).post(doc, args.options);
  });
  nodify(promise, callback);
  return promise;
};

exports.validatingRemove = function (doc, options, callback) {
  var args = processArgs(this, callback, options);

  doc._deleted = true;
  var promise = doValidation(args.db, doc, args.options).then(function () {
    return methods(args.db).remove(doc, args.options);
  });
  nodify(promise, callback);
  return promise;
};

exports.validatingBulkDocs = function (bulkDocs, options, callback) {
  //the ``all_or_nothing`` attribute on ``bulkDocs`` is unsupported.
  //Also, the result array might not be in the same order as
  //``bulkDocs.docs``
  var args = processArgs(this, callback, options);

  var done = [];
  var notYetDone = [];

  if (!Array.isArray(bulkDocs)) {
    bulkDocs = bulkDocs.docs;
  }

  var validations = bulkDocs.map(function (doc) {
    doc._id = doc._id || uuid.v4();
    var validationPromise = doValidation(args.db, doc, args.options);

    return validationPromise.then(function (resp) {
      notYetDone.push(doc);
    }).catch(function (err) {
      err.id = doc._id;
      done.push(err);
    });
  });
  var allValidationsPromise = Promise.all(validations).then(function () {
    return methods(args.db).bulkDocs(notYetDone, args.options);
  }).then(function (insertedDocs) {
    return done.concat(insertedDocs);
  });
  nodify(allValidationsPromise, callback);
  return allValidationsPromise;
};

var vpa = function (docId, attachmentId, rev, attachment, type, options, callback) {
  var args = processArgs(this, callback, options);

  //get the doc
  var promise = args.db.get(docId, {rev: rev, revs: true}).catch(function (err) {
    return {_id: docId};
  }).then(function (doc) {
    //validate the doc + attachment
    doc._attachments = doc._attachments || {};
    doc._attachments[attachmentId] = {
      content_type: type,
      data: attachment,
    };
    return doValidation(args.db, doc, args.options);
  }).then(function () {
    //save the attachment
    return methods(args.db).putAttachment(docId, attachmentId, rev, attachment, type);
  });
  nodify(promise, callback);
  return promise;
};
exports.validatingPutAttachment = vpa;

var vra = function (docId, attachmentId, rev, options, callback) {
  var args = processArgs(this, callback, options);
  //get the doc
  var promise = args.db.get(docId, {rev: rev, revs: true}).then(function (doc) {
    //validate the doc without attachment
    delete doc._attachments[attachmentId];

    return doValidation(args.db, doc, args.options);
  }).then(function () {
    //remove the attachment
    return methods(args.db).removeAttachment(docId, attachmentId, rev);
  });
  nodify(promise, callback);
  return promise;
};
exports.validatingRemoveAttachment = vra;

exports.installValidationMethods = function () {
  var db = this;

  if (dbs.indexOf(db) !== -1) {
    throw new PouchPluginError({
      status: 500,
      name: "already_installed",
      message: "Validation methods are already installed on this database."
    });
  }

  dbs.push(db);
  methodsByDbsIdx.push(methodsFromDb(db));
  methodNames.forEach(function (name) {
    db[name] = exports["validating" + name[0].toUpperCase() + name.substr(1)].bind(db);
  });
};

exports.uninstallValidationMethods = function () {
  var db = this;

  var index = dbs.indexOf(db);
  if (index === -1) {
    throw new PouchPluginError({
      status: 500,
      name: "already_not_installed",
      message: "Validation methods are already not installed on this database."
    });
  }
  var meths = methods(db);
  methodNames.forEach(function (name) {
    db[name] = meths[name];
  });

  //cleanup
  dbs.splice(index, 1);
  methodsByDbsIdx.splice(index, 1);
};
