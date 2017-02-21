import {PouchDB, Security, setup, teardown, shouldThrowError} from './utils';

let db;

describe('Security tests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);
  it('get when unset', async () => {
    (await db.getSecurity()).should.eql({});
  });
  it('put', async () => {
    const secObj = {members: {roles: 'test'}};
    (await db.putSecurity(secObj)).should.eql({ok: true});
    (await db.getSecurity()).should.eql(secObj);
  });
});

describe('Installed security tests', () => {
  const rightlessUser = {name: null, roles: []};
  async function before() {
    db = setup();
    db.installSecurityMethods();
    await db.putSecurity({
      admins: {
        names: ['admin'],
        roles: ['admin']
      },
      members: {
        names: ['member'],
        roles: ['member']
      }
    })
  }
  beforeEach(before);
  afterEach(async () => {
    db.uninstallSecurityMethods()
    await teardown();
  });

  it('basic', () => {
    // lets setUp() and tearDown() do all the work...
  })
  it('double install', () => {
    //1 install: setUp()
		//2 install:
    (()=> db.installSecurityMethods()).should.throw(Error);
  });
  it('double uninstall', () => {
    //1 remove:
		db.uninstallSecurityMethods();
		//2 remove:
		(() => db.uninstallSecurityMethods()).should.throw(Error);
		//recover for tearDown()
		db.installSecurityMethods();
  });
  it('all docs', async () => {
    const resp = await db.allDocs({userCtx: {
			name: 'admin',
			roles: []
		}});
		resp.total_rows.should.equal(0);

    const err = await shouldThrowError(async () => {
      await db.allDocs({userCtx: {
				'name': 'unknown',
				'roles': []
			}});
    });
		err.status.should.equal(401);
		err.name.should.equal('unauthorized');
		err.message.should.equal('You are not authorized to access this db.');
  });
  it('query', async () => {
    const userCtx = {
			name: null,
			roles: ['member']
		}
    const err = await shouldThrowError(async () => {
      await db.query({map: null}, {userCtx: userCtx});
    });
		err.status.should.equal(401);

    const err2 = await shouldThrowError(async () => {
      await db.query('unexisting-view-func', {userCtx: userCtx});
    });
		err2.status.should.equal(404);
  });
  it('compact', async () => {
    //member may not compact
    const err = await shouldThrowError(async () => {
      await db.compact({userCtx: {
				name: 'member',
				roles: []
			}});
    });
		err.status.should.equal(401);
		//admin may compact
		(await db.compact({userCtx: {
			name: 'admin',
			roles: []
		}})).ok.should.be.ok;
		//server admin (admin party = default) may compact
		(await db.compact()).ok.should.be.ok;
  });

  it('doc modifications', async () => {
    const err = await shouldThrowError(async () => {
      await db.post({}, {userCtx: rightlessUser});
    });
    err.status.should.equal(401);
    const resp = await db.post({});

    const resp2 = await db.put({}, resp.id, resp.rev);
    resp2.rev.indexOf('2-').should.equal(0);

    (await db.remove(resp2.id, resp2.rev)).ok.should.be.ok;

    const resp3 = await db.bulkDocs([{}, {_id: '_design/test'}], {userCtx:{
      name: null,
      roles: ['a', 'member']
    }});
    let errorSeen = false;
    let successSeen = false;
    resp3.forEach(result => {
      if (result.status === 401) {
        errorSeen = true;
      }
      if ((result.rev || '').indexOf('1-') === 0) {
        successSeen = true;
      }
    });
    errorSeen.should.be.ok;
    successSeen.should.be.ok;
  });

  it('post without login', async () => {
    (await db.putSecurity({})).ok.should.be.ok;
    const resp = await db.post({}, {userCtx: rightlessUser});
    resp.ok.should.be.ok;
  });

  it('revs diff', async () => {
    (await db.revsDiff({})).should.eql({});
  });

  it('attachment', async () => {
    const buf = new Buffer('');
    const resp = await db.putAttachment('docId', 'attachmentId', buf, 'text/plain');
    resp.ok.should.be.ok;

    const resp2 = await db.getAttachment('docId', 'attachmentId');
    resp2.type.should.equal('text/plain');

    const err = await shouldThrowError(async () => {
      await db.putAttachment('docId', 'attachmentId', buf, 'text/plain', {userCtx: rightlessUser});
    });
    err.status.should.equal(401);

    const err2 = await shouldThrowError(async () => {
      await db.removeAttachment(resp.id, 'attachmentId', resp.rev, {userCtx: rightlessUser});
    });
    err2.status.should.equal(401);
  });

  it('view cleanup', async () => {
    const err = await shouldThrowError(async () => {
      await db.viewCleanup({userCtx: rightlessUser});
    });
    err.status.should.equal(401);
  });

  it('get security', async () => {
    const resp = await db.getSecurity({userCtx: {name: 'member', roles: []}});
    resp.should.have.property('admins');
  })

  it('replicate', async () => {
    const resp = await db.replicate.to('testb');
    resp.ok.should.be.ok;
  });

  it('remove alternative signature', async () => {
    const err = await shouldThrowError(async () => {
      await db.remove('id', 'rev', {userCtx: rightlessUser});
    });
    err.status.should.equal(401);
  });

  it('show', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('some/non-existing/values', {secObj: {
        admins: {'names': ['unknown']}
      }, userCtx: {
        name: 'unknown',
        roles: []
      }});
    });
    err.status.should.equal(404) // not 401!
  });

  it('destroy', async () => {
    (await db.destroy()).ok.should.be.ok;

    await before();

    const err = await shouldThrowError(async () => {
      await db.destroy({userCtx: rightlessUser});
    });
    err.status.should.equal(401);
  });

  it('changes', () => {
    const result = db.changes({live: true, userCtx: {
      name: 'marten',
      roles: ['member']
    }});
    result.on('change', () => {});
    result.cancel();
  });
});

describe('Static security methdods installed', async () => {
  beforeEach(() => {
    Security.installStaticSecurityMethods(PouchDB);
  });
  afterEach(() => {
    Security.uninstallStaticSecurityMethods(PouchDB);
  });

  it('basic', () => {
    // beforeEach() and afterEach()
  });
  it('installing twice', async () => {
    //1: beforeEach
    //2:
    (() => {
      Security.installStaticSecurityMethods(PouchDB);
    }).should.throw(/already installed/);
  })

  it('uninstalling twice', async () => {
    Security.uninstallStaticSecurityMethods(PouchDB);
    (() => {
      Security.uninstallStaticSecurityMethods(PouchDB);
    }).should.throw(/not installed/);

    // for afterEach
    Security.installStaticSecurityMethods(PouchDB);
  });

  it('destroy', async () => {
    new PouchDB('test');
    const err = await shouldThrowError(async () => {
      await PouchDB.destroy('test', {userCtx: {name: null, roles: []}});
    });
    err.status.should.equal(401);

    // admin paty - should be no problem
    const resp = await PouchDB.destroy({name: 'test'});
    resp.ok.should.be.ok;
  });

  it('replicate', async () => {
    const db = new PouchDB('a');
    await db.putSecurity({members: {names: ['hi!']}});
    const err = await shouldThrowError(async () => {
      await PouchDB.replicate(new PouchDB('a'), 'b', {userCtx: {name: null, roles: []}});
    });
    err.status.should.equal(401);

    // admin party - should be no problem
    (await PouchDB.replicate('a', 'b')).ok.should.be.ok;
  });

  it('new() alternate signature', async () => {
    const err = await shouldThrowError(async () => {
      await PouchDB.new({name: 'test', userCtx: {name: null, roles: []}});
    });
    err.status.should.equal(401);
  });
});

describe('Async security tests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  it('basic', done => {
    const secObj = {members: {roles: 'test'}};

    db.putSecurity(secObj, (err, resp) => {
      if (err) {
        return done(err);
      }
      resp.should.eql({ok: true});

      db.getSecurity((err, resp2) => {
        resp2.should.eql(secObj);
        done(err);
      });
    });
  });

  it('put attachment', done => {
    db.installSecurityMethods();

    db.putAttachment('docId', 'attachmentId', new Buffer(''), 'text/plain', {userCtx: {
      name: null,
      roles: []
    }}, (err, resp) => {
      resp.ok.should.be.ok;
      db.uninstallSecurityMethods();
      done(err);
    });
  });
});
