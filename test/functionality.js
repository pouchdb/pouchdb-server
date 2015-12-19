import {setup, teardown, should, shouldThrowError} from './utils';
import extend from 'extend';

let db;

beforeEach(() =>
  db = setup()
);

afterEach(teardown);

describe('SyncAuthTests', () => {
  beforeEach(async () => {
    should.not.exist(await db.useAsAuthenticationDB({isOnlineAuthDB: false}));
  });

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

    const session3 = await db.session({sessionID: "not-the-default-one"});
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

  function shouldBeSuccesfulLogIn(data, roles) {
    data.should.eql({
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

  it('should support admin logins', async () => {
    const admins = {
      username: "-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10"
		};
		shouldNotBeLoggedIn(await db.session({admins: admins}));
		const logInData = await db.logIn("username", "test", {admins: admins});
		shouldBeSuccesfulLogIn(logInData, ["_admin"]);

		//if admins not supplied, there's no session (admin party!)
    shouldBeAdminParty(await db.session());
		//otherwise there is
		const sessionData = await db.session({admins: admins});
		shouldBeLoggedIn(sessionData, ["_admin"]);

		//check if logout works (shouldn't need to know about admins -
		//just cancel the session.)
		await db.logOut();
		shouldNotBeLoggedIn(await db.session({admins: admins}));
  });

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

  it('should handle invalid admins field on login', async () => {
    const admins = {
      username: "-pbkdf2-37508a1f1c5c19f38779fbe029ae99ee32988293,885e6e9e9031e391d5ef12abbb6c6aef,10",
      username2: 'this-is-no-hash'
    };
    shouldNotBeLoggedIn(await db.session({admins: admins}));
    const error = await shouldThrowError(async () =>
      await db.logIn("username2", "test", {admins: admins})
    );
    error.status.should.equal(401);
    shouldNotBeLoggedIn(await db.session({admins: admins}));
  });

  afterEach(async () => {
    should.not.exist(await db.stopUsingAsAuthenticationDB());
  });
});

describe('AsyncAuthTests', () => {
  it('should suport the basics', done => {
    function cb(err) {
      if (err) {
        return done(err);
      }
      db.stopUsingAsAuthenticationDB(done);
    }
    db.useAsAuthenticationDB(cb);
  });
});

describe('AsyncAuthTestsWithoutDaemon', () => {
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
