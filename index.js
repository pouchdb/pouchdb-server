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
var nodify = require("promise-nodify");
var uuid = require("node-uuid");
var Validation = require("pouchdb-validation");
var equals = require("equals");
var extend = require("extend");

//CouchDB _users validation function
function validate_doc_update(newDoc, oldDoc, userCtx) {
  function reportError(error_msg) {
    console.log('Error writing document `' + newDoc._id +
      '\' to the replicator database: ' + error_msg);
    throw({forbidden: error_msg});
  }

  function validateEndpoint(endpoint, fieldName) {
    if ((typeof endpoint !== 'string') &&
      ((typeof endpoint !== 'object') || (endpoint === null))) {

      reportError('The `' + fieldName + '\' property must exist' +
        ' and be either a string or an object.');
    }

    if (typeof endpoint === 'object') {
      if ((typeof endpoint.url !== 'string') || !endpoint.url) {
        reportError('The url property must exist in the `' +
          fieldName + '\' field and must be a non-empty string.');
      }

      if ((typeof endpoint.auth !== 'undefined') &&
        ((typeof endpoint.auth !== 'object') ||
          endpoint.auth === null)) {

        reportError('`' + fieldName +
          '.auth\' must be a non-null object.');
      }

      if ((typeof endpoint.headers !== 'undefined') &&
        ((typeof endpoint.headers !== 'object') ||
          endpoint.headers === null)) {

        reportError('`' + fieldName +
          '.headers\' must be a non-null object.');
      }
    }
  }

  var isReplicator = (userCtx.roles.indexOf('_replicator') >= 0);
  var isAdmin = (userCtx.roles.indexOf('_admin') >= 0);

  if (oldDoc && !newDoc._deleted && !isReplicator &&
    (oldDoc._replication_state === 'triggered')) {
    reportError('Only the replicator can edit replication documents ' +
      'that are in the triggered state.');
  }

  if (!newDoc._deleted) {
    validateEndpoint(newDoc.source, 'source');
    validateEndpoint(newDoc.target, 'target');

    if ((typeof newDoc.create_target !== 'undefined') &&
      (typeof newDoc.create_target !== 'boolean')) {

      reportError('The `create_target\' field must be a boolean.');
    }

    if ((typeof newDoc.continuous !== 'undefined') &&
      (typeof newDoc.continuous !== 'boolean')) {

      reportError('The `continuous\' field must be a boolean.');
    }

    if ((typeof newDoc.doc_ids !== 'undefined') &&
      !Array.isArray(newDoc.doc_ids)) {

      reportError('The `doc_ids\' field must be an array of strings.');
    }

    if ((typeof newDoc.filter !== 'undefined') &&
      ((typeof newDoc.filter !== 'string') || !newDoc.filter)) {

      reportError('The `filter\' field must be a non-empty string.');
    }

    if ((typeof newDoc.query_params !== 'undefined') &&
      ((typeof newDoc.query_params !== 'object') ||
        newDoc.query_params === null)) {

      reportError('The `query_params\' field must be an object.');
    }

    if (newDoc.user_ctx) {
      var user_ctx = newDoc.user_ctx;

      if ((typeof user_ctx !== 'object') || (user_ctx === null)) {
        reportError('The `user_ctx\' property must be a ' +
          'non-null object.');
      }

      if (!(user_ctx.name === null ||
        (typeof user_ctx.name === 'undefined') ||
        ((typeof user_ctx.name === 'string') &&
          user_ctx.name.length > 0))) {

        reportError('The `user_ctx.name\' property must be a ' +
          'non-empty string or null.');
      }

      if (!isAdmin && (user_ctx.name !== userCtx.name)) {
        reportError('The given `user_ctx.name\' is not valid');
      }

      if (user_ctx.roles && !Array.isArray(user_ctx.roles)) {
        reportError('The `user_ctx.roles\' property must be ' +
          'an array of strings.');
      }

      if (!isAdmin && user_ctx.roles) {
        for (var i = 0; i < user_ctx.roles.length; i++) {
          var role = user_ctx.roles[i];

          if (typeof role !== 'string' || role.length === 0) {
            reportError('Roles must be non-empty strings.');
          }
          if (userCtx.roles.indexOf(role) === -1) {
            reportError('Invalid role (`' + role +
              '\') in the `user_ctx\'');
          }
        }
      }
    } else {
      if (!isAdmin) {
        reportError('The `user_ctx\' property is missing (it is ' +
           'optional for admins only).');
      }
    }
  } else {
    if (!isAdmin) {
      if (!oldDoc.user_ctx || (oldDoc.user_ctx.name !== userCtx.name)) {
        reportError('Replication documents can only be deleted by ' +
          'admins or by the users who created them.');
      }
    }
  }
}

var DESIGN_DOC = {
  _id: "_design/_replicator",
  language: "javascript",
  validate_doc_update: validate_doc_update.toString()
};

var dbs = [];
var changesCancelFuncsByDbIdx = [];
var activeReplicationCancelsByDbIdxAndRepId = [];
var activeReplicationSignaturesByDbIdxAndRepId = [];

exports.startReplicator = function (callback) {
  //When the replicator is started:
  //- replication is started for every already existing document in the
  //  database
  //- subscribing 'live' to the changes feed of the database commences
  //  for future updates
  //- strict validation rules (using the pouchdb-validation plug-in
  //  behind the screens) come into effect for the database.
  var db = this;

  if (dbs.indexOf(db) !== -1) {
    return Promise.reject({
      error: true,
      status: 500,
      name: "already_active",
      message: "Replicator already active on this database."
    });
  }
  Validation.installValidationMethods.call(db);

  var promise = db.put(DESIGN_DOC)
    .catch(function () {/*that's fine, probably already there*/})
    .then(function () {
      return db.allDocs({
        include_docs: true,
        startkey: "_design0",
      });
    })
    .then(function (allDocs) {
      //start listening for changes on the replicator db
      var cancelable = db.changes({
        since: "now",
        live: true,
        returnDocs: false
      }).on("change", function (change) {
        onChanged(db, change.doc);
      });
      dbs.push(db);
      activeReplicationCancelsByDbIdxAndRepId.push({});
      activeReplicationSignaturesByDbIdxAndRepId.push({});
      changesCancelFuncsByDbIdx.push(cancelable.cancel.bind(cancelable));

      //start replication for current docs
      allDocs.rows.forEach(function (row) {
        onChanged(db, row.doc);
      });
    });

  nodify(promise, callback);
  return promise;
};

exports.stopReplicator = function () {
  //synchronous method; stops all replications & listening to future
  //changes & relaxes the validation rules for the database again.
  var db = this;
  var index = dbs.indexOf(db);
  if (index === -1) {
    throw {
      error: true,
      status: 500,
      name: "already_inactive",
      message: "Replicator already inactive on this database."
    };
  }
  changesCancelFuncsByDbIdx.splice(index, 1)[0]();
  activeReplicationSignaturesByDbIdxAndRepId.splice(index, 1);

  var activeReplicationCancelsByRepId = activeReplicationCancelsByDbIdxAndRepId.splice(index, 1)[0];
  for (var key in activeReplicationCancelsByRepId) {
    if (activeReplicationCancelsByRepId.hasOwnProperty(key)) {
      activeReplicationCancelsByRepId[key]();
    }
  }

  Validation.uninstallValidationMethods.call(db);
};

var replicatorChangeActive = false;

function putAsReplicatorChange(db, doc) {
  if (doc._replication_state) {
    doc._replication_state_time = Date.now();
  }

  replicatorChangeActive = true;
  db.put(doc);
  replicatorChangeActive = false;
}

function onChanged(db, doc) {
  //Stops/starts replication as required by the description in ``doc``.

  var PouchDB = db.constructor;
  var currentSignature;

  if (replicatorChangeActive) {
    //prevent recursion
    return;
  }
  var dbIdx = dbs.indexOf(db);
  var activeReplicationCancelsByRepId = activeReplicationCancelsByDbIdxAndRepId[dbIdx];
  var activeReplicationSignaturesByRepId = activeReplicationSignaturesByDbIdxAndRepId[dbIdx];

  if (doc._replication_id && doc._replication_state === "triggered") {
    //stop the replication
    var cancel = activeReplicationCancelsByRepId[doc._replication_id];
    cancel();
    currentSignature = activeReplicationSignaturesByRepId[doc._replication_id];

    cleanupReplicationData(db, doc);
  }
  if (!doc._replication_id) {
    currentSignature = extend({}, doc);
    delete currentSignature._id;
    delete currentSignature._rev;

    var done = false;
    //check if the signatures match ({repId: signature} format)
    for (var repId in activeReplicationSignaturesByRepId) {
      if (activeReplicationSignaturesByRepId.hasOwnProperty(repId)) {
        var signature = activeReplicationCancelsByRepId[repId];
        if (equals(signature, currentSignature)) {
          doc._replication_id = repId;
          done = true;
        }
      }
    }
    if (!done) {
      doc._replication_id = uuid.v4();
      doc._replication_state = "triggered";
    }
  }
  if (doc._replication_state === "triggered") {
    var replication = PouchDB.replicate(doc.source, doc.target, doc);
    activeReplicationCancelsByRepId[doc._replication_id] = replication.cancel.bind(replication);
    activeReplicationSignaturesByRepId[doc._replication_id] = currentSignature;
    replication.on("complete", onReplicationComplete.bind(null, db, doc._id));
    replication.on("change", onReplicationError.bind(null, db, doc._id));
  }

  putAsReplicatorChange(doc);
}

function cleanupReplicationData(db, doc) {
  //cleanup replication data which is now no longer necessary
  var dbIdx = dbs.indexOf(db);
  var activeReplicationCancelsByRepId = activeReplicationCancelsByDbIdxAndRepId[dbIdx];
  var activeReplicationSignaturesByRepId = activeReplicationSignaturesByDbIdxAndRepId[dbIdx];

  delete activeReplicationCancelsByRepId[doc._replication_id];
  delete activeReplicationSignaturesByRepId[doc._replication_id];
}

function onReplicationComplete(db, docId, info) {
  db.get(docId).then(function (doc) {
    cleanupReplicationData(db, doc);

    doc._replication_state = "completed";
    putAsReplicatorChange(doc);
  });
}

function onReplicationError(db, docId, info) {
  db.get(docId).then(function (doc) {
    cleanupReplicationData(db, doc);

    doc._replication_state = "error";
    doc._replication_state_reason = info.message;
    putAsReplicatorChange(doc);
  });
}
