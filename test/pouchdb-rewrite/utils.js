import stuff from 'pouchdb-plugin-helper/testutils';
import Rewrite from '../../packages/pouchdb-rewrite';

import List from '../../packages/pouchdb-list';
import Security from '../../packages/pouchdb-security';
import Show from '../../packages/pouchdb-show';
import Update from '../../packages/pouchdb-update';
import Validation from '../../packages/pouchdb-validation';

import AllDbs from '../../packages/pouchdb-all-dbs';
import SeamlessAuth from 'pouchdb-seamless-auth';

stuff.PouchDB.plugin(Rewrite);

stuff.PouchDB.plugin(List);
stuff.PouchDB.plugin(Security);
stuff.PouchDB.plugin(Show);
stuff.PouchDB.plugin(Update);
stuff.PouchDB.plugin(Validation);

AllDbs(stuff.PouchDB);
SeamlessAuth(stuff.PouchDB);

stuff.rewriteDocument = {
	_id: '_design/test',
	rewrites: [
		{
			from: '/test/all',
			to: '_list/test/ids'
		}
	]
};

stuff.checkUuid = uuid => {
	uuid.should.be.a('string');
	uuid.length.should.be.greaterThan(30);
};

module.exports = stuff;
