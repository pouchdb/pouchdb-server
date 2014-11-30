"use strict";

var db, starting;

module.exports = function enableReplicator(PouchDB, app, config, dbWrapper) {
  PouchDB.plugin(require('pouchdb-replicator'));

  function getReplicatorDBName() {
    return config.get('replicator', 'db');
  }

  // explain how to activate the replicator db logic.
  dbWrapper.registerWrapper(function (name, db, next) {
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

  config.on('replicator.db', function () {
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
