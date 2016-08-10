import {setup, teardown} from './utils';

let db;

describe('PouchDB-Show: signatures', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('show', () => {
    const promise = db.show('test/test/test', () => {});
    promise.then.should.be.ok;
    promise.catch.should.be.ok;
  });
});
