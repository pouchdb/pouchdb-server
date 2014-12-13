"use strict";

module.exports = function enableValidation(app, PouchDB) {
  PouchDB.plugin(require('pouchdb-validation'));

  app.dbWrapper.registerWrapper(function (name, db, next) {
    db.installValidationMethods();

    next();
  });
};
