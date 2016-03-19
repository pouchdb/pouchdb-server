import {setup, teardown, should, shouldThrowError} from './utils';
import extend from 'extend';

let db;

function shouldBeAdminParty(session) {
  session.info.should.eql({
    "authentication_handlers": ["api"],
    "authentication_db": "test"
  });
  session.userCtx.should.eql({
    "name": null,
    "roles": ["_admin"]
  });
  session.ok.should.be.ok;
}

function shouldNotBeLoggedIn(session) {
  session.info.should.eql({
    authentication_handlers: ["api"],
    authentication_db: "test"
  });
  session.userCtx.should.eql({
    name: null,
    roles: []
  });
  session.ok.should.be.ok;
}

function shouldBeSuccesfulLogIn(data, roles) {
  var copy = extend({}, data);
  // irrelevant
  delete copy.sessionID;
  copy.should.eql({
    "ok": true,
    "name": "username",
    "roles": roles
  });
}

function shouldBeLoggedIn(session, roles) {
  session.userCtx.should.eql({
    "name": "username",
    "roles": roles
  });
  session.info.authenticated.should.equal("api");
}

describe('SyncAuthTests', () => {
  beforeEach(async () => {
    db = setup()
    should.not.exist(await db.useAsAuthenticationDB({isOnlineAuthDB: false}));
  });
  afterEach(teardown);

  it('should test the daemon', () => {
    // handled by beforeEach and afterEach
  });

  it('should not allow stopping usage as an auth db twice', async () => {
    await db.stopUsingAsAuthenticationDB();
    await shouldThrowError(async () =>
      await db.stopUsingAsAuthenticationDB()
    );
    // startup for afterEach
    await db.useAsAuthenticationDB();
  });

  it('should not allow using a db as an auth db twice', async () => {
    //1: beforeEach()
    //2: see below:
    await shouldThrowError(async () =>
      await db.useAsAuthenticationDB()
    );
  });

  it('should have working db methods', async () => {
    const signUpData = await db.signUp("username", "password", {roles: ["test"]});
    signUpData.rev.indexOf("1-").should.equal(0);
    signUpData.ok.should.be.ok;
    signUpData.id.should.equal("org.couchdb.user:username");

    const doc = await db.get("org.couchdb.user:username");
    doc._rev.indexOf("1-").should.equal(0);
    doc.should.have.property("derived_key");
    doc.iterations.should.equal(10);
    doc.name.should.equal("username");
    doc.password_scheme.should.equal("pbkdf2");
    doc.roles.should.eql(["test"]);
    doc.should.have.property("salt");
    doc.type.should.equal("user");

    doc.should.not.have.property("password");

    const session = await db.session();
    shouldBeAdminParty(session);

    const logInData = await db.logIn("username", "password");
    shouldBeSuccesfulLogIn(logInData, ["test"]);

    const session2 = await db.session();
    shouldBeLoggedIn(session2, ["test"]);

    const session3 = await db.multiUserSession();
    shouldBeAdminParty(session3);

    const logOutData = await db.logOut();
    logOutData.ok.should.be.ok;
    const session4 = await db.session();
    shouldBeAdminParty(session4);

    //should also give a {ok: true} when not logged in.
    const logOutData2 = await db.logOut();
    logOutData2.ok.should.be.ok;

    const error = await shouldThrowError(async () =>
      await db.logIn("username", "wrongPassword")
    );
    error.status.should.equal(401);
    error.name.should.equal("unauthorized");
    error.message.should.equal("Name or password is incorrect.");
  });

  it('should support sign up without roles', async () => {
    const result = await db.signUp("username", "password");
		result.ok.should.be.ok;

		const resp2 = await db.get("org.couchdb.user:username");
		resp2.roles.should.eql([]);
  });

  it('should validate docs', async () => {
    const error = await shouldThrowError(async () =>
      await db.post({})
    );
    error.status.should.equal(403);

    const resp = await db.bulkDocs([{}]);
    resp[0].status.should.equal(403);
  });

  it('should handle conflicting logins', async () => {
		const doc1 = {
      _id: "org.couchdb.user:test",
			_rev: "1-blabla",
			type: "user",
			name: "test",
			roles: []
		};
		const doc2 = extend({}, doc1);
		doc2._rev = "2-something";
		//generate conflict
		await db.bulkDocs([doc1, doc2], {new_edits: false});

    const error = await shouldThrowError(async () =>
      await db.logIn("test", "unimportant")
    );

    error.status.should.equal(401);
    error.name.should.equal("unauthorized");
    error.message.should.contain("conflict");
  });

  it('should not accept invalid session ids', async () => {
    const err = await shouldThrowError(async () => {
      await db.multiUserSession('invalid-session-id');
    });
    err.status.should.equal(400);
    err.name.should.equal('bad_request');
    err.message.should.contain('Malformed');
  });

  it('should hash plain-text passwords in bulkDocs', async () => {
    // https://github.com/pouchdb/express-pouchdb/issues/297
    const resp = await db.bulkDocs({docs: [{
      _id: "org.couchdb.user:testuser",
      name:"testuser",
      password:"test",
      type:"user",
      roles:[]
    }]});
    should.not.exist((await db.get(resp[0].id)).password);
  });
});

describe('AsyncAuthTests', () => {
  beforeEach(async () => {
    db = setup();
  });
  afterEach(teardown);
  it('should suport the basics', done => {
    function cb(err) {
      db.stopUsingAsAuthenticationDB();
      done(err);
    }
    db.useAsAuthenticationDB(cb);
  });
});

describe('AsyncAuthTestsWithoutDaemon', () => {
  beforeEach(async () => {
    db = setup()
  });
  afterEach(teardown);

  it('should be impossible to use the various exposed methods', () => {
    should.not.exist(db.signUp);
    should.not.exist(db.session);
    should.not.exist(db.logIn);
    should.not.exist(db.logOut);
  });

  it('should hash admin passwords', async () => {
    const admins = {
			test: "-pbkdf2-0abe2dcd23e0b6efc39004749e8d242ddefe46d1,16a1031881b31991f21a619112b1191fb1c41401be1f31d5,10",
			test2: "test"
		};
		const resp = await db.hashAdminPasswords(admins);
		resp.test.should.equal(admins.test);
		//10 is the default amount of iterations
		resp.test2.indexOf("-pbkdf2-").should.equal(0);
    resp.test2.lastIndexOf(",10").should.equal(resp.test2.length - 3);
  });

  it('should support changing admin passwords hash iterations', async () => {
    const resp = await db.hashAdminPasswords({
      abc: "test"
    }, {iterations: 11});
    resp.abc.indexOf("-pbkdf2-").should.equal(0);
    resp.abc.lastIndexOf(",11").should.equal(resp.abc.length - 3);
  });
});

describe('No automated test setup', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('should support admin logins', async () => {
    const opts = {
      admins: {
        username: '-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10'
      },
      secret: db.generateSecret()
    };
    await db.useAsAuthenticationDB(opts);

    shouldNotBeLoggedIn(await db.multiUserSession());
    const logInData = await db.multiUserLogIn('username', 'test');
    shouldBeSuccesfulLogIn(logInData, ['_admin']);

    db.stopUsingAsAuthenticationDB();
    await db.useAsAuthenticationDB({/* no admins */});

    //if admins not supplied, there's no session (admin party!)
    shouldBeAdminParty(await db.multiUserSession(logInData.sessionID));

    db.stopUsingAsAuthenticationDB();
    await db.useAsAuthenticationDB(opts);

    //otherwise there is
    const sessionData = await db.multiUserSession(logInData.sessionID);
    shouldBeLoggedIn(sessionData, ["_admin"]);

    //check if logout works (i.e. forgetting the session id.)
    shouldNotBeLoggedIn(await db.multiUserSession());
  });

  it('should handle invalid admins field on login', async () => {
    const admins = {
      username: "-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10",
      username2: 'this-is-no-hash'
    };
    await db.useAsAuthenticationDB({admins: admins});

    shouldNotBeLoggedIn(await db.session());
    const error = await shouldThrowError(async () =>
      await db.logIn("username2", "test")
    );
    error.status.should.equal(401);
    shouldNotBeLoggedIn(await db.session());
  });

  it('should not accept timed out sessions', async () => {
    // example stolen from calculate-couchdb-session-id's test suite. That
    // session timed out quite a bit ago.

    await db.useAsAuthenticationDB({
      secret: '4ed13457964f05535fbb54c0e9f77a83',
      timeout: 3600,
      admins: {
        // password 'test'
        'jan': '-pbkdf2-2be978bc2be874f755d8899cfddad18ed78e3c09,d5513283df4f649c72757a91aa30bdde,10'
      }
    })

    var sessionID = 'amFuOjU2Njg4MkI5OkEK3-1SRseo6yNRHfk-mmk6zOxm';
    shouldNotBeLoggedIn(await db.multiUserSession(sessionID));
  });
});
