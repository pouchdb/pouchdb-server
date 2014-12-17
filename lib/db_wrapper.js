"use strict";

var Promise = require('bluebird');

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
  var promise = callInInterruptableChain(this._wrappers, [name, db]);
  return promise.then(function () {
    return db;
  });
};

DatabaseWrapper.prototype.registerWrapper = function (wrapper) {
  this._wrappers.push(wrapper);
};

function callInInterruptableChain(funcs, args) {
  var i = 0;
  function next() {
    var func = funcs[i];
    var result = Promise.resolve();
    if (typeof func !== 'undefined') {
      i += 1;
      result = result.then(function () {
        return func.apply(null, args);
      });
    }
    return result;
  }
  args.push(next);
  return next();
}
