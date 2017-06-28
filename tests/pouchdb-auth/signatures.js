import {setup, teardown, Auth} from './utils';

describe('hashAdminPasswords', () => {
  it('should return a promise', async () => {
    (await Auth.hashAdminPasswords({})).should.eql({});
  });
  it('should return a promise and accept a callback', async () => {
    const cb = () => {};
    (await Auth.hashAdminPasswords({}, cb)).should.eql({});
  });
});

describe('workflow', () => {
  let db;
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('should not throw and methods should return promises', async () => {
    await db.useAsAuthenticationDB();
    await db.session(() => {});
    db.stopUsingAsAuthenticationDB();
  });
});
