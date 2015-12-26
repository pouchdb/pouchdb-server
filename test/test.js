import {PouchDB, setup, teardown, should, shouldThrowError} from 'pouchdb-plugin-helper/testutils';
import Replicator from '../';
import extend from 'extend';

PouchDB.plugin(Replicator);

const replicationDocument = {
	"_id": "my_replication",
	"source": "a",
	"target": "b",
	"continuous": true
}

let db;

describe('async replicator tests', () => {
	beforeEach(() => {
		db = setup();
	});
	afterEach(teardown);

	it('basic', done => {
		db.startReplicator((err, res) => {
			if (err) return done(err);

			should.not.exist(res);
			db.stopReplicator((err, res) => {
				should.not.exist(res);
				done(err);
			});
		});
	})
});

describe('sync replicator tests', () => {
	beforeEach(async () => {
		db = setup();

		should.not.exist(await db.startReplicator());
	});
	afterEach(async () => {
		should.not.exist(await db.stopReplicator());

		await new PouchDB('a').destroy();
		await new PouchDB('b').destroy();

		await teardown();
	});

	it('basic', () => {
		// let beforeEach & afterEach do their job
	});

	it('start twice', async () => {
		const err = await shouldThrowError(async () => {
			await db.startReplicator();
		});
		err.status.should.equal(500);
		err.name.should.equal('already_active');
	});

	it('stop twice', async () => {
		// stop
		await db.stopReplicator();

		// second stop
		const err = await shouldThrowError(async () => {
			await db.stopReplicator();
		});
		err.toString().should.contain('500');
		err.toString().should.contain('already_inactive');

		// restart for afterEach
		await db.startReplicator();
	});

	async function replicationCompletion(db, name) {
		let doc;
		do {
			doc = await db.get(name);
		} while (doc._replication_state !== 'completed');
		return doc;
	}

	it('replication validation', async () => {
		const err = await shouldThrowError(async () => {
			await db.post({});
		});
		err.status.should.equal(403);
	});

	it('simple replication', async () => {
		await new PouchDB('a').put({_id: 'test'});
		const repDoc = extend({}, replicationDocument);
		delete repDoc.continuous;
		const resp = await db.put(repDoc);
		resp.ok.should.be.ok;

		await replicationCompletion(db, 'my_replication');

		// fails if the document isn't there.
		await new PouchDB('b').get('test');
	});

	it('change replication', async () => {
		await new PouchDB('a').put({}, 'test');
		const repDoc = extend({}, replicationDocument);
		delete repDoc.continuous;
		const resp = await db.put(repDoc);
		resp.ok.should.be.ok;

		const doc = await replicationCompletion(db, 'my_replication');

		doc.source = 'b';
		doc.target = 'c';
		delete doc._replication_state;
		const resp2 = await db.put(doc);
		resp2.ok.should.be.ok;

		await replicationCompletion(db, 'my_replication');

		const dbC = new PouchDB('c');
		await dbC.get('test');
		await dbC.destroy();
	});

	it('delete replication', async () => {
		const dbA = new PouchDB('a');
		await dbA.put({}, 'test1');

		const resp = await db.put(replicationDocument);
		resp.ok.should.be.ok;

		let doc;
		do {
			doc = await db.get('my_replication');
		} while(!doc._replication_id);
		const resp2 = await db.remove(doc);
		resp2.ok.should.be.ok;

		dbA.put({}, 'test2');
		const dbB = new PouchDB('b');
		await dbB.get('test1');
		const err = await shouldThrowError(async () => {
			await dbB.get('test2');
		});
		err.status.should.equal(404);
	});

	it('double resplication', async () => {
		const resp = await db.put(replicationDocument);
		resp.ok.should.be.ok;

		// first replication active
		let doc;
		do {
			doc = await db.get('my_replication');
		} while (!doc._replication_state === 'triggered');

		// start second
		const repDoc = extend({}, replicationDocument);
		repDoc._id = 'my_replication2';
		const resp2 = await db.put(repDoc);
		resp2.ok.should.be.ok;

		let firstDoc, secondDoc;
		do {
			firstDoc = await db.get('my_replication');
			secondDoc = await db.get('my_replication2');
		} while (!(firstDoc._replication_id && firstDoc._replication_id === secondDoc._replication_id));

		firstDoc.should.have.property('_replication_state');
		secondDoc.should.not.have.property('_replication_state');
	});

	it('replication error', async () => {
		const repDoc = extend({}, replicationDocument);
		// unlikely couchdb port
		repDoc.source = 'http://localhost:3423/test';
		// FIXME: https://github.com/pouchdb/pouchdb-replicator/issues/2
		repDoc.retry = false;
		await db.put(repDoc);

		let doc;
		do {
			doc = await db.get('my_replication');
		} while (doc._replication_state !== 'error');
	});
});
