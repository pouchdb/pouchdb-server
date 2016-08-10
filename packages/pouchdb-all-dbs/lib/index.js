'use strict';

var utils = require('./pouch-utils');
var TaskQueue = require('./taskqueue');

var PREFIX = "db_";

function prefixed(dbName) {
  //A database name starting with an underscore is valid, but a document
  //id starting with an underscore is not in most cases. Because of
  //that, they're prefixed in the all dbs database. See issue #7 for
  //more info.
  return PREFIX + dbName;
}

function unprefixed(dbName) {
  return dbName.slice(PREFIX.length);
}

module.exports = function (Pouch) {

  var ALL_DBS_NAME = 'pouch__all_dbs__';
  var pouch;
  var cache;
  var queue = new TaskQueue();

  function log(err) {
    /* istanbul ignore if */
    if (err) {
      console.error(err); // shouldn't happen
    }
  }
  
  function init() {
    queue.add(function (callback) {
      if (pouch) {
        return callback();
      }
      pouch = new Pouch(ALL_DBS_NAME);
      callback();
    });
  }

  function normalize(name) {
    return name.replace(/^_pouch_/, ''); // TODO: remove when fixed in Pouch
  }

  function canIgnore(dbName) {
    return (dbName === ALL_DBS_NAME) ||
      // TODO: get rid of this when we have a real 'onDependentDbRegistered'
      // event (pouchdb/pouchdb#2438)
      (dbName.indexOf('-mrview-') !== -1) ||
      // TODO: might be a better way to detect remote DBs
      (/^https?:\/\//.test(dbName));
  }

  Pouch.on('created', function (dbName) {
    dbName = normalize(dbName);
    if (canIgnore(dbName)) {
      return;
    }
    dbName = prefixed(dbName);
    init();
    queue.add(function (callback) {
      pouch.get(dbName).then(function () {
        // db exists, nothing to do
      }).catch(function (err) {
        /* istanbul ignore if */
        if (err.name !== 'not_found') {
          throw err;
        }
        return pouch.put({_id: dbName});
      }).then(function () {
        if (cache) {
          cache[dbName] = true;
        }
        callback();
      }, callback);
    }, log);
  });

  Pouch.on('destroyed', function (dbName) {
    dbName = normalize(dbName);
    if (canIgnore(dbName)) {
      return;
    }
    dbName = prefixed(dbName);
    init();
    queue.add(function (callback) {
      pouch.get(dbName).then(function (doc) {
        return pouch.remove(doc);
      }).catch(/* istanbul ignore next */ function (err) {
        // normally a not_found error; nothing to do
        if (err.name !== 'not_found') {
          throw err;
        }
      }).then(function () {
        /* istanbul ignore else */
        if (cache) {
          delete cache[dbName];
        }
        callback();
      }, callback);
    }, log);
  });

  Pouch.allDbs = utils.toPromise(function (callback) {
    init();
    queue.add(function (callback) {

      if (cache) {
        return callback(null, Object.keys(cache).map(unprefixed));
      }

      // older versions of this module didn't have prefixes, so check here
      var opts = {startkey: PREFIX, endkey: (PREFIX + '\uffff')};
      pouch.allDocs(opts).then(function (res) {
        cache = {};
        var dbs = [];
        res.rows.forEach(function (row) {
          dbs.push(unprefixed(row.key));
          cache[row.key] = true;
        });
        callback(null, dbs);
      }).catch(/* istanbul ignore next */ function (err) {
        console.error(err);
        callback(err);
      });
    }, callback);
  });

  Pouch.resetAllDbs = utils.toPromise(function (callback) {
    queue.add(function (callback) {
      pouch.destroy().then(function () {
        pouch = null;
        cache = null;
        callback();
      }).catch(/* istanbul ignore next */ function (err) {
        console.error(err);
        callback(err);
      });
    }, callback);
  });
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  module.exports(window.PouchDB);
}
