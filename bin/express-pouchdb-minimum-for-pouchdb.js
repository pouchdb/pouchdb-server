'use strict';

var PouchDB = require('pouchdb');

var app = require('../packages/node_modules/express-pouchdb')(PouchDB, {
  mode: 'minimumForPouchDB'
});
app.listen(6984);
