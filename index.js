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

//TODO: call http equivalent if http adapter

var Promise = require("bluebird");

var coucheval = require("couchdb-eval");
var couchdb_objects = require("couchdb-objects");
var nodify = require("promise-nodify");

function addOldDoc(db, id, args) {
  return db.get(id).then(function (err) {
    args.push(null);
    return args;
  }, function (doc) {
    args.push(doc);
    return args;
  });
}

function doValidation(db, newDoc, options, callback) {
  //a new promise because sometimes it's possible to declare a
  //document valid early on in the process.
  return new Promise(function (resolve, reject) {
    function doActualValidation(args) {
      var validationFuncs = args[0];
      var newOptions = args[1];
      var oldDoc = args[2];

      try {
        validationFuncs.forEach(function (validationFunc) {
          validationFunc(newDoc, oldDoc, newOptions.userCtx, newOptions.secObj);
        });
      } catch (e) {
        if (typeof e.unauthorized !== "undefined") {
          reject({
            error: "unauthorized",
            reason: e.unauthorized,
            status: 401
          });
        } else if (typeof e.forbidden !== "undefined") {
          reject({
            error: "forbidden",
            reason: e.forbidden,
            status: 403
          });
        } else {
          reject(coucheval.wrapExecutionError(e));
        }
        throw "done";
      }
      //passed all validation functions -> success
      resolve();
    }

    if ((newDoc._id || "").indexOf("_design/") === 0) {
      //a design document -> always validates succesful.
      resolve();
      //done
      return;
    }
    //gather required data
    var validationFuncsPromise = getValidationFunctions(db).then(function (validationFuncs) {
      if (!validationFuncs.length) {
        resolve();
        throw "done";
      }
      return validationFuncs;
    });
    var completeOptionsPromise = completeValidationOptions(db, options);

    Promise.all([validationFuncsPromise, completeOptionsPromise]).then(function (args) {
      //gather last piece of data & start the actual validation
      addOldDoc(db, newDoc._id, args).then(doActualValidation);
    }).catch(reject);
  });
}

function completeValidationOptions(db, options) {
  if (!options) {
    options = {};
  }
  if (!options.secObj) {
    options.secObj = couchdb_objects.buildSecurityObject();
  }
  if (!options.userCtx) {
    var buildUserContext = couchdb_objects.buildUserContextObject;
    return db.info().then(buildUserContext).then(function (userCtx) {
      options.userCtx = userCtx;
      return options;
    });
  }
  return Promise.resolve(options);
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
      doc: row.doc,
      func: row.doc.validate_doc_update
    };
  });
  validationFuncs = validationFuncs.filter(function (info) {
    return typeof info.func !== "undefined";
  });
  validationFuncs = validationFuncs.map(function (info) {
    //convert str -> function
    return coucheval.evaluate(info.doc, {}, info.func);
  });
  return validationFuncs;
}

function processArgs(db, callback, options) {
  if (!callback) {
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
    return args.db.put(doc, args.options);
  });
  nodify(promise, callback);
  return promise;
};

exports.validatingPost = function (doc, options, callback) {
  //fixme: see bulkDocs: set id if not one already early.
  var args = processArgs(this, callback, options);
  var promise = doValidation(args.db, doc, args.options).then(function () {
    return args.db.post(doc, args.options);
  });
  nodify(promise, callback);
  return promise;
};

exports.validatingRemove = function (doc, options, callback) {
  var args = processArgs(this, callback, options);

  doc._deleted = true;
  var promise = doValidation(args.db, doc, args.options).then(function () {
    return args.db.remove(doc, args.options);
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
  var todo = [];

  var validations = bulkDocs.docs.map(function (doc) {
    return doValidation(args.db, doc, args.options).then(function (resp) {
      todo.push(doc);
    }, function (err) {
      //FIXME: _id should be set by this moment. As should it in
      //post. Fix that (using db.id(), which is private but I guess
      //acceptable in this case.)
      err.id = doc._id;
      done.push(err);
    });
  });
  var promise = Promise.all(validations).then(function () {
    return args.db.bulkDocs({docs: todo}, args.options);
  }).then(function (insertedDocs) {
    return done.concat(insertedDocs);
  });
  nodify(promise, callback);
  return promise;
};

var vpa = function (docId, attachmentId, rev, attachment, type, options, callback) {
  var args = processArgs(this, callback, options);

  //get the doc
  var promise = args.db.get(docId, {rev: rev}).catch(function (err) {
    //TODO: check if the thingy should have a _rev already here.
    //and is that even possible?
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
    return args.db.putAttachment(docId, attachmentId, rev, attachment, type);
  });
  nodify(promise, callback);
  return promise;
};
exports.validatingPutAttachment = vpa;

var vra = function (docId, attachmentId, rev, options, callback) {
  var args = processArgs(this, callback, options);
  //get the doc
  var promise = args.db.get(docId, {rev: rev}).then(function (doc) {
    //validate the doc without attachment
    delete doc._attachments[attachmentId];

    return doValidation(args.db, doc, args.options);
  }).then(function () {
    //remove the attachment
    return args.db.removeAttachment(docId, attachmentId, rev);
  });
  nodify(promise, callback);
  return promise;
};
exports.validatingRemoveAttachment = vra;
