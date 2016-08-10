import Security from '../../packages/pouchdb-security';
import Show from '../../packages/pouchdb-show';
import stuff from 'pouchdb-plugin-helper/testutils';

stuff.PouchDB.plugin(Security);
stuff.Security = Security;
stuff.PouchDB.plugin(Show);

module.exports = stuff;
