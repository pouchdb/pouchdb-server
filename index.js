"use strict";

//FIXME.
exports.updatingPut = function (doc, _id, _rev, options, callback) {
  if (options.validation) {
    db.validatingPut();
  } else {
    db.put();
  }
};
exports.updatingPost = function (doc, options, callback) {
  if (options.validation) {
    db.validatingPost();
  } else {
    db.post();
  }
};
