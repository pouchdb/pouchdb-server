"use strict";

module.exports = function enableValidation(PouchDB, app, config, dbWrapper) {
  PouchDB.plugin(require('pouchdb-validation'));

  dbWrapper.registerWrapper(function (name, db, next) {
    db.installValidationMethods();

    next();
  });
};
