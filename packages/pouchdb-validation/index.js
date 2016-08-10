/*
	Copyright 2013-2015, Marten de Vries

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
var wrappers = require("pouchdb-wrappers");
var createBulkDocsWrapper = require("pouchdb-bulkdocs-wrapper");
var PouchPluginError = require("pouchdb-plugin-error");

var uuid = require("random-uuid-v4");
var Promise = require("pouchdb-promise");

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

function doValidation(db, newDoc, options) {
  var isHttp = ["http", "https"].indexOf(db.type()) !== -1;
  if (isHttp && !options.checkHttp) {
    //CouchDB does the checking for itself. Validate succesful.
    return Promise.resolve();
  }
  if (String(newDoc._id).indexOf("_design/") === 0 || String(newDoc._id).indexOf("_local") === 0) {
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

    return Promise.all([completeOptionsPromise, oldDocPromise])
      .then(Function.prototype.apply.bind(function (completeOptions, oldDoc) {
        return validate(validationFuncs, newDoc, oldDoc, completeOptions);
      }, null));
  });
}

function completeValidationOptions(db, options) {
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

function getValidationFunctions(db) {
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

var wrapperApi = {};

wrapperApi.put = function (orig, args) {
  return doValidation(args.db, args.doc, args.options).then(orig);
};

wrapperApi.post = function (orig, args) {
  args.doc._id = args.doc._id || uuid();
  return doValidation(args.db, args.doc, args.options).then(orig);
};

wrapperApi.remove = function (orig, args) {
  args.doc._deleted = true;
  return doValidation(args.db, args.doc, args.options).then(orig);
};

wrapperApi.bulkDocs = createBulkDocsWrapper(function (doc, args) {
  doc._id = doc._id || uuid();
  return doValidation(args.db, doc, args.options);
});

wrapperApi.putAttachment = function (orig, args) {
  return args.db.get(args.docId, {rev: args.rev, revs: true})
    .catch(function () {
      return {_id: args.docId};
    })
    .then(function (doc) {
      //validate the doc + attachment
      doc._attachments = doc._attachments || {};
      doc._attachments[args.attachmentId] = {
        content_type: args.type,
        data: args.doc
      };

      return doValidation(args.db, doc, args.options);
    })
    .then(orig);
};

wrapperApi.removeAttachment = function (orig, args) {
  return args.db.get(args.docId, {rev: args.rev, revs: true})
    .then(function (doc) {
      //validate the doc without attachment
      delete doc._attachments[args.attachmentId];

      return doValidation(args.db, doc, args.options);
    })
    .then(orig);
};

Object.keys(wrapperApi).forEach(function (name) {
  var exportName = "validating" + name[0].toUpperCase() + name.substr(1);
  var orig = function () {
    return this[name].apply(this, arguments);
  };
  exports[exportName] = wrappers.createWrapperMethod(name, orig, wrapperApi[name]);
});

exports.installValidationMethods = function () {
  var db = this;

  try {
    wrappers.installWrapperMethods(db, wrapperApi);
  } catch (err) {
    throw new PouchPluginError({
      status: 500,
      name: "already_installed",
      message: "Validation methods are already installed on this database."
    });
  }
};

exports.uninstallValidationMethods = function () {
  var db = this;

  try {
    wrappers.uninstallWrapperMethods(db, wrapperApi);
  } catch (err) {
    throw new PouchPluginError({
      status: 500,
      name: "already_not_installed",
      message: "Validation methods are already not installed on this database."
    });
  }
};
