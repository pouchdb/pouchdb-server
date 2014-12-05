module.exports = function enableDiskSize(PouchDB, app, config, dbWrapper) {
  PouchDB.plugin(require('pouchdb-size'));
  dbWrapper.registerWrapper(function (name, db, next) {
    db.installSizeWrapper();
    return next();
  });
}
