import {setupHTTP, teardown, rewriteDocument, shouldThrowError} from './utils';

let db;

describe('http', () => {
  beforeEach(async () => {
    db = setupHTTP();
    await db.put(rewriteDocument);
  });
  afterEach(teardown);

  it('rewrite', async () => {
    const err = await shouldThrowError(async () => {
      await db.rewrite('test/test/all');
    });
    err.status.should.equal(404);
    err.name.should.equal('not_found');
  });
});
