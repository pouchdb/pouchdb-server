"use strict";

var db, starting;

module.exports = function enableReplicator(app, PouchDB) {
  PouchDB.plugin(require('pouchdb-replicator'));
  app.couchConfig.registerDefault('replicator', 'db', '_replicator');

  function getReplicatorDBName() {
    return app.couchConfig.get('replicator', 'db');
  }

  // explain how to activate the replicator db logic.
  app.dbWrapper.registerWrapper(function (name, db, next) {
    if (name === getReplicatorDBName()) {
      return db.useAsReplicatorDB();
    }
    return next();
  });

  // the following code makes sure there's always a replicator db
  function startReplicatorDaemon() {
    var name = getReplicatorDBName();
    db = new PouchDB(name);

    starting = db.startReplicatorDaemon();
  }
  startReplicatorDaemon();

  app.couchConfig.on('replicator.db', function () {
    starting.then(function () {
      //stop old replicator daemon
      db.stopReplicatorDaemon();
      //start the new one
      startReplicatorDaemon();
    });
  });

  PouchDB.on('destroyed', function (dbName) {
    // if the replicator db was removed, it should re-appear.
    if (dbName === getReplicatorDBName()) {
      startReplicatorDaemon();
    }
  });
};
