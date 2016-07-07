import {setupHTTP, teardown, updateDocument, should} from './utils';

let db;

describe('http tests', () => {
  beforeEach(async () => {
    db = setupHTTP();
    await db.put(updateDocument);
  })
  afterEach(teardown);

  it('update', async () => {
    const [doc, req] = JSON.parse((await db.update('test/args/my-id')).body);
    should.not.exist(doc);
    req.id.should.equal('my-id');
  });
});
