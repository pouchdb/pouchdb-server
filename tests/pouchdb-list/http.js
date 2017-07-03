import {setupHTTP, teardown, listDocument, shouldThrowError, should} from './utils';

let db;

describe('http', () => {
  beforeEach(async () => {
    db = setupHTTP();
    await db.put(listDocument);
  });
  afterEach(teardown);

  it('list basics', async () => {
    const resp = await db.list('test/args/ids', {query: {a: 'b'}});

    const [head, req] = JSON.parse(resp.body).args;
    head.offset.should.equal(0);
    head.total_rows.should.equal(0);

    should.equal(req.id, null);
    req.raw_path.should.equal('/pouchdb-plugin-helper-db/_design/test/_list/args/ids?a=b');
    req.requested_path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_list', 'args', 'ids?a=b']);
    req.path.should.eql(['pouchdb-plugin-helper-db', '_design', 'test', '_list', 'args', 'ids']);
    // and one at random, to check if the rest (shared with show) is still ok.
    req.peer.should.equal('127.0.0.1');
  });

  it('wrong list content type', async () => {
    // CouchDB only supports application/json here. It's a CouchDB restriction:
    // this check is here in case it ever changes. - then  PouchDB-List's
    // simulation of it can stop.

    const err = await shouldThrowError(async () => {
      await db.list('test/args/ids', {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body:'value=hello'
      });
    });
    err.status.should.equal(400);
    err.name.should.equal('bad_request');
    err.message.should.equal('invalid_json');
  })
});
