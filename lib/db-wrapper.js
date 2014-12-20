"use strict";

var Promise = require('bluebird');
var utils = require('./utils');

function DatabaseWrapper() {
  // Databases can be wrapped to let them provide extra functionality.
  // Examples of this include document validation, authorisation, and
  // keeping track of the documents in _replicator.
  //
  // The logic of that is spread out through different parts of
  // express-pouchdb, all of which register their functionality on this
  // object. This way, the actual wrapping process is abstracted away.
  this._wrappers = [];
}
module.exports = DatabaseWrapper;

DatabaseWrapper.prototype.wrap = function (name, db) {
  if (typeof db === 'undefined') {
    throw new Error("no db defined!");
  }
  return utils.callAsyncRecursive(this._wrappers, function (wrapper, next) {
    return Promise.resolve().then(function () {
      return wrapper(name, db, next);
    });
  }).then(function () {
    // https://github.com/pouchdb/pouchdb/issues/1940
    delete db.then;
    return db;
  });
};

DatabaseWrapper.prototype.registerWrapper = function (wrapper) {
  this._wrappers.push(wrapper);
};
