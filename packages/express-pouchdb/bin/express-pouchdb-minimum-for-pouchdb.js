'use strict';

var PouchDB = require('pouchdb-node');

var app = require('../')(PouchDB, {
  mode: 'minimumForPouchDB'
});
app.listen(6984);
