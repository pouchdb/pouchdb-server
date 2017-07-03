import {setupHTTP, teardown, shouldThrowError, onlyTestValidationDoc} from './utils';

let db;
function before() {
  db = setupHTTP();
}

describe('signature http tests', () => {
  beforeEach(before);
  afterEach(teardown);
  it('should work with post', async () => {
    // Tests one special validation case to complete JS coverage
    await db.validatingPost({});
  });
});

describe('http tests', () => {
  beforeEach(before);
  afterEach(teardown);
  //FIXME: re-enable (related to bug report)
  it.skip('should work', async () => {
    await db.put(onlyTestValidationDoc);
    const error = await shouldThrowError(async () => {
      await db.validatingPost({});
    });
    error.status.should.equal(403);
    error.name.should.equal('forbidden');
    error.message.should.equal("only a document named 'test' is allowed.");

    const resp = await db.validatingPut({_id: 'test'});
    resp.ok.should.be.ok;
  });
});
