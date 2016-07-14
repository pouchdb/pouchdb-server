import {setup, setupWithDoc, teardown, updateDocument, should, shouldThrowError} from './utils';

let db;

describe('Sync update tests', () => {
  beforeEach(async () => {
    db = (await setupWithDoc()).db;
    await db.put(updateDocument);
  });
  afterEach(teardown);

  it('args', async () => {
    const resp = await db.update('test/args/mytest', {query: {'a': 3}})
    const [doc, req] = JSON.parse(resp.body);
    doc.test.should.be.ok;
    req.id.should.equal('mytest');
    req.raw_path.should.equal('/test/_design/test/_update/args/mytest?a=3');
  });

  it('args without doc', async () => {
    const resp = await db.update('test/args', {withValidation: true});

    const [doc, req] = JSON.parse(resp.body);
    should.equal(doc, null);
    req.should.not.have.property('withValidation');
  });

  it('unexisting function', async () => {
    const err = await shouldThrowError(async () => {
      await db.update('test/unexisting/mytest');
    });
    err.toString().should.be.ok;
    err.name.should.equal('not_found');
    err.message.should.equal('missing update function unexisting on design doc _design/test')
  });

  it('saving', async () => {
    const resp = await db.update('test/save-adding-date', {body: JSON.stringify({
      _id: 'test',
      name: 'Today'
    })});
    resp.body.should.equal('Hello World!');

    const doc = await db.get('test');
    doc.updated.should.be.ok;
    doc.name.should.equal('Today');
  });
});

describe('Async update tests', () => {
  beforeEach(done => {
    db = setup();
    db.put(updateDocument, done);
  });
  afterEach(teardown);

  it('exception', done => {
    db.update('test/exception', err => {
      err.status.should.equal(500);
      err.name.should.equal('ReferenceError');
      err.message.should.contain('abc');

      done();
    });
  });
});

describe('Async update with empty design doc', () => {
  beforeEach(done => {
    db = setup();
    db.put({_id: '_design/test'}, done);
  });
  afterEach(teardown);

  it('basic', done => {
    db.update('test/unexisting', err => {
      err.status.should.equal(404);
      err.name.should.equal('not_found');
      err.message.should.equal('missing update function unexisting on design doc _design/test');

      done();
    });
  });
});
