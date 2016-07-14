import Auth from '../../packages/pouchdb-all-dbs';
import stuff from 'pouchdb-plugin-helper/testutils';
import extend from 'extend';

stuff.PouchDB.plugin(Auth);

module.exports = extend({Auth}, stuff);
