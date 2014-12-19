"use strict";

var Promise = require('bluebird');

function DaemonManager() {
  // There are a few things express-pouchdb needs to do outside of
  // requests. These things can't get a PouchDB object from the request
  // like other code does. Instead, they register themselves here and
  // get an object passed in. By providing both a start and stop
  // function, it is possible to switch PouchDB objects on the fly.
  this._daemons = [];
}

DaemonManager.prototype.registerDaemon = function (daemon) {
  this._daemons.push(daemon);
};

['start', 'stop'].forEach(function (name) {
  DaemonManager.prototype[name] = function (PouchDB) {
    var promises = this._daemons.map(function (daemon) {
      return Promise.resolve().then(function () {
        if (daemon[name]) {
          return daemon[name](PouchDB);
        }
      });
    });

    return Promise.all(promises).then(function () {
      // don't resolve to a specific value
    });
  };
});

module.exports = DaemonManager;
