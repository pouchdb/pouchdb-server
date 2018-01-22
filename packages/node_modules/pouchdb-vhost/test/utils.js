import stuff from 'pouchdb-plugin-helper/testutils';
import Show from 'pouchdb-show';
import Rewrite from 'pouchdb-rewrite';
import VirtualHost from '../';

stuff.PouchDB.plugin(Show);
stuff.PouchDB.plugin(Rewrite);
VirtualHost(stuff.PouchDB);

module.exports = stuff;
