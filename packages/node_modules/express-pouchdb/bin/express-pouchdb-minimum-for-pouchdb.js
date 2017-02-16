'use strict';

var PouchDB = require('pouchdb');

var app = require('../')(PouchDB, {
  mode: 'minimumForPouchDB'
});
app.listen(6984);
