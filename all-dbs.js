var Pouch = require('pouchdb');

var pouch = new Pouch('pouch__all_dbs__');

Pouch.on('created', function (dbName) {
  if (dbName === 'pouch__all_dbs__') {
    return;
  }
  pouch.get('db_' + dbName).then(function (doc) {
    // db exists, nothing to do
  }).catch(function (err) {
    if (err.name !== 'not_found') {
      console.error(err);
      return;
    }
    pouch.put({_id: 'db_' + dbName}).catch(function (err) {
      console.error(err);
    });
  });
});

Pouch.on('destroyed', function (dbName) {
  pouch.get('db_' + dbName).then(function (doc) {
    pouch.remove(doc).catch(function (err) {
      console.error(err);
    });
  }).catch(function (err) {
    // normally a not_found error; nothing to do
    if (err.name !== 'not_found') {
      console.error(err);
    }
  });
});

module.exports = function(callback) {
  pouch.allDocs().then(function (res) {
    var dbs = res.rows.map(function (row) {
      return row.key.replace(/^db_/, '');
    }).filter(function (dbname) {
      return dbname !== 'pouch__all_dbs__';
    });
    callback(null, dbs);
  }).catch(function (err) {
    callback(err);
  })
};