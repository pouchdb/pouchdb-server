import Auth from '../';
import stuff from 'pouchdb-plugin-helper/testutils';
import extend from 'extend';

stuff.PouchDB.plugin(Auth);

module.exports = extend({Auth}, stuff);
