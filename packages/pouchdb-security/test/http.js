import {setupHTTP, teardown} from './utils';

describe('HTTP tests', () => {
  let db;
  beforeEach(() => {
    db = setupHTTP();
  });
  afterEach(async () => {
    //restore security document so the db can be easily deleted.
    await db.putSecurity({});
    await teardown();
  });

  it('should function', async () => {
		(await db.getSecurity()).should.eql({});
		(await db.putSecurity({a: 1})).should.eql({ok: true});
		(await db.getSecurity()).should.eql({a: 1});
  });
});
