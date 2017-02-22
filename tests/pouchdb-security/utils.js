const Security = require('../../packages/node_modules/pouchdb-security');
const Show = require('pouchdb-show');
const stuff = require('pouchdb-plugin-helper/testutils');

stuff.PouchDB.plugin(Security);
stuff.Security = Security;
stuff.PouchDB.plugin(Show);

module.exports = stuff;
