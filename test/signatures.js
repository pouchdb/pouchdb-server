import {PouchDB, Auth} from './utils';

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
  it('should not throw and methods should return promises', async () => {
    const db = new PouchDB('test');
    await db.useAsAuthenticationDB();
    await db.session(() => {});
    await db.stopUsingAsAuthenticationDB();
    await db.destroy();
  });
});
