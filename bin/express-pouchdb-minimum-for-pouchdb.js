'use strict';

var PouchDB = require('../node_modules/pouchdb');

var app = require('../')(PouchDB, {
  mode: 'minimumForPouchDB'
});
app.listen(6984);