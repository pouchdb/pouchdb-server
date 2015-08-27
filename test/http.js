import {BASE_URL, HTTP_AUTH, PouchDB, should, shouldThrowError} from './utils';

describe('SyncHTTPAuthTests', () => {
	it('should work with http dbs', async () => {
		const db = new PouchDB(BASE_URL + "/_users", {auth: HTTP_AUTH});
		should.not.exist(await db.useAsAuthenticationDB());

		try {
			const signUpData = await db.signUp("username", "password", {roles: ["test"]});

			signUpData.rev.indexOf("1-").should.equal(0);
			signUpData.ok.should.be.ok;
			signUpData.id.should.equal("org.couchdb.user:username")

			const doc = await db.get("org.couchdb.user:username")
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
			//basic auth active
			shouldBeAdmin(session);

			const logInData = await db.logIn("username", "password");
			logInData.should.eql({
				ok: true,
				name: "username",
				roles: ["test"]
			});

			const session2 = await db.session();
			session2.userCtx.should.eql({
				name: "username",
				roles: ["test"]
			});
			session2.info.authenticated.should.equal("cookie");

			const logOutData = await db.logOut();
			logOutData.ok.should.be.ok;
			//basic auth still active
			const session3 = await db.session();
			shouldBeAdmin(session3);

			//should also give a {ok: true} when not logged in.
			const logOutData2 = await db.logOut();
			logOutData2.ok.should.be.ok;

			const error = await shouldThrowError(async () =>
				await db.logIn("username", "wrongPassword")
			);
			error.status.should.equal(401);
			error.name.should.equal("unauthorized");
			error.message.should.equal("Name or password is incorrect.");
		} finally {
			try {
				const doc = await db.get("org.couchdb.user:username");
				const removeResp = await db.remove(doc);
				removeResp.ok.should.be.ok;
			} finally {
				should.not.exist(await db.stopUsingAsAuthenticationDB());
			}
		}
	});

	function shouldBeAdmin(session) {
		session.info.authentication_handlers.should.contain("cookie");
		session.info.authentication_db.should.equal("_users")
		session.userCtx.should.eql({
			name: (HTTP_AUTH || {}).username || null,
			roles: ["_admin"]
		});
		session.ok.should.be.ok;
	}
});
