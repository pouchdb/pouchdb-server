import {waitUntilReady, cleanup, PouchDB, should, BASE_URL, HTTP_AUTH} from './utils';

const url = BASE_URL + '/_users';

describe('sync seamless auth tests without remote', () => {
  before(waitUntilReady);
  afterEach(cleanup);

  it('test', async () => {
    const resp = await PouchDB.seamlessSignUp('username', 'password');
    resp.ok.should.be.ok;
    const s = await PouchDB.seamlessSession();
    s.info.authentication_db.should.equal('_users');
    should.equal(s.userCtx.name, null);
    (await PouchDB.seamlessLogIn('username', 'password')).name.should.equal('username');
    (await PouchDB.seamlessLogOut()).ok.should.be.ok;
  });
});

describe('sync seamless auth tests with remote', () => {
  let remoteDB, localDB;
  before(waitUntilReady);
  beforeEach(async () => {
    await PouchDB.setSeamlessAuthRemoteDB(url, {auth: HTTP_AUTH});
    remoteDB = new PouchDB(url, {auth: HTTP_AUTH});
    localDB = new PouchDB('_users');
  });
  afterEach(async () => {
    // local
    await cleanup();
    // remote
    PouchDB.unsetSeamlessAuthRemoteDB()
    try {
      await remoteDB.remove(await remoteDB.get('org.couchdb.user:username'));
    } catch (err) {/* already not there apparently*/}
  });

  it('test', async () => {
    const resp = await PouchDB.seamlessSignUp('username', 'password');
    resp.ok.should.be.ok;

    // check replication from remote to local
    let doc;
    // ethernal loop when the test doesn't pass
    do {
      try {
        doc = await localDB.get(resp.id);
      } catch (err) {/* document not yet replicated */}
    } while (!doc);

    // check if online session
    (await PouchDB.seamlessLogIn('username', 'password')).name.should.equal('username');
    const s = await PouchDB.seamlessSession();
    s.info.authentication_handlers.should.contain('cookie');

    // update the local document and check if replicated back
    doc.abc = 1;
    localDB.put(doc);

    // triggers the replication
    PouchDB.invalidateSeamlessAuthCache();
    await PouchDB.seamlessSession();

    let remoteDoc;
    do {
      remoteDoc = await remoteDB.get(resp.id);
    } while(!remoteDoc.abc);

    // test caching code
    await PouchDB.seamlessSession();
    await PouchDB.seamlessSession();

    // log out
    (await PouchDB.seamlessLogOut()).ok.should.be.ok;
  });
});

describe('async seamless auth tests', () => {
  before(waitUntilReady);
  afterEach(cleanup);

  it('set remote db', done => {
    PouchDB.setSeamlessAuthRemoteDB(url, {auth: HTTP_AUTH}, (err, resp) => {
      should.not.exist(resp);
      should.not.exist(PouchDB.unsetSeamlessAuthRemoteDB());
      done(err);
    });
  });
});
