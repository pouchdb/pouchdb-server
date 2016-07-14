import stuff from 'pouchdb-plugin-helper/testutils';
import Show from '../../packages/pouchdb-show';
import Rewrite from '../../packages/pouchdb-rewrite';
import VirtualHost from '../../packages/pouchdb-vhost';

stuff.PouchDB.plugin(Show);
stuff.PouchDB.plugin(Rewrite);
VirtualHost(stuff.PouchDB);

module.exports = stuff;
