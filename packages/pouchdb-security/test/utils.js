import Security from '../';
import Show from 'pouchdb-show';
import stuff from 'pouchdb-plugin-helper/testutils';

stuff.PouchDB.plugin(Security);
stuff.Security = Security;
stuff.PouchDB.plugin(Show);

module.exports = stuff;
