import {setup, teardown, listDocument, shouldThrowError, should} from './utils';

let db;

describe('Async list tests', () => {
	beforeEach(done => {
		db = setup();
		function ddocCb() {
			db.put({_id: 'testdoc'}, done);
		}
		db.put(listDocument, ddocCb);
	});
	afterEach(teardown);

	it('args', done => {
		db.list('test/args/ids', {query: {a: 'b'}}, (err, resp) => {
			const [head, req] = JSON.parse(resp.body).args;
			head.offset.should.equal(0);
			should.equal(req.id, null);
			req.query.a.should.equal('b');

			done(err);
		});
	});
});

describe('Sync list tests with empty design docs', () => {
	beforeEach(async () => {
		db = setup();
		await db.put({_id: '_design/test'});
	});
	afterEach(teardown);

	it('test', async () => {
		const err = await shouldThrowError(async () => {
			await db.list('test/test/test');
		});
		err.status.should.equal(404);
		err.name.should.equal('not_found');
	});
});

describe('Sync list tests', () => {
	beforeEach(async () => {
		db = setup();
		await db.put(listDocument);
		await db.put({_id: 'testdoc'});
	});
	afterEach(teardown);

	it('couch eval', async () => {
		const resp = await db.list('test/test-coucheval/ids');
		resp.code.should.equal(200);
		resp.body.should.equal('6 - Hello World!');
	});

	it('args', async () => {
		const resp = await db.list('test/args/ids', {query: {a: 'b'}});
		const [head, req] = JSON.parse(resp.body).args;
		head.offset.should.equal(0);
		head.total_rows.should.equal(1);

		should.equal(req.id, null);
		req.raw_path.should.equal('/test/_design/test/_list/args/ids?a=b');
		req.requested_path.should.eql(['test', '_design', 'test', '_list', 'args', 'ids?a=b']);
		req.path.should.eql(['test', '_design', 'test', '_list', 'args', 'ids']);
		// and one at random, to check if the rest (shared with show) is still ok.
		req.peer.should.equal('127.0.0.1')
	});

	it('unexisting design doc', async () => {
		const err = await shouldThrowError(async () => {
			await db.list('unexisting/args/ids');
		});
		err.name.should.equal('not_found');
	});

	it('unexisting list function', async () => {
		const err = await shouldThrowError(async () => {
			await db.list('test/unexisting/ids');
		});
		err.toString().should.be.ok;
		err.name.should.equal('not_found');
		err.message.should.equal('missing list function unexisting on design doc _design/test');
	});

	it('unexisting view', async () => {
		const err = await shouldThrowError(async () => {
			await db.list('test/args/unexisting');
		});
		err.name.should.equal('not_found');
	});

	it('list api', async () => {
		const resp = await db.list('test/use-list-api/ids');
		resp.headers['Transfer-Encoding'].should.equal('chunked');
		resp.code.should.equal(500);
		const [row1, row2] = resp.body.split('\n');
		JSON.parse(row1).should.eql({id: 'testdoc', key: 'testdoc', value: 'value'});
		row2.should.equal('testHello World!');
	});

	it('wrong content type', async () => {
		// CouchDB only supports application/json here. It's a CouchDB restriction:
		// probably best to emulate it...

		const err = await shouldThrowError(async () => {
			await db.list('test/args/ids', {
				headers: {'Content-Type': 'application/x-www-form-urlencoded'},
				body: 'hello=world'
			});
		});
		err.status.should.equal(400);
		err.name.should.equal('bad_request');
		err.message.should.equal('invalid_json');
	});
});
