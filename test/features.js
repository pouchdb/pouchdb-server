import {setup, setupWithDoc, setupWithDocAndAttachment, teardown, should, shouldThrowError, onlyTestValidationDoc} from './utils';

let db;

describe('basic validation tests', () => {
  beforeEach(async () => {
    db = setup();
    await db.put(onlyTestValidationDoc);
  });

  afterEach(teardown);

  it('should allow put', async () => {
    const doc = await db.validatingPut({_id: 'test'});
    doc.ok.should.be.ok;
  });
  it('should allow post', async () => {
    const doc = await db.validatingPost({_id: 'test'});
    doc.ok.should.be.ok;
  });
  it('should allow remove', async() => {
    const info = await db.put({_id: 'test'});
    const rmInfo = await db.validatingRemove({
      _id: 'test',
      _rev: info.rev
    });
    rmInfo.ok.should.be.ok;
  });
  it('should allow bulkDocs', async () => {
    const resp = await db.validatingBulkDocs([
      {
        _id: 'test'
      }
    ]);
    resp[0].should.be.ok;
  });
  it('should allow putAttachment', (cb) => {
    function getCb(resp) {
      resp.toString('ascii').should.equal('Hello world!');
      cb();
    }
    function putCb(err, resp) {
      resp.ok.should.be.ok;
      db.getAttachment('test', 'test').then(getCb)
    }
    const blob = new Buffer('Hello world!', 'ascii');
    db.validatingPutAttachment('test', 'test', blob, "text/plain", putCb);
  });
  it('should fail', async () => {
    //setup - put an attachment
    const blob = new Buffer('Hello world!', 'ascii');
    const resp = await db.putAttachment('mytest', 'test', blob, 'text/plain');
    const error = await shouldThrowError(async () => {
      await db.validatingRemoveAttachment('mytest', 'test', resp.rev);
    });
    error.status.should.equal(403);
    error.name.should.equal('forbidden');
  });
});

describe('unauthorized validation tests', () => {
  let rev;
  beforeEach(async () => {
    const data = await setupWithDoc();
    db = data.db;
    rev = data.rev;
    await db.put({
      _id: '_design/test',
      validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
				if (newDoc._id !== "test") {
					throw({unauthorized: "only a document named 'test' is allowed."});
				}
			}`
    });
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('unauthorized');
    err.message.should.equal("only a document named 'test' is allowed.")
  }

  it('should fail an invalid put', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingPut({_id: 'test_invalid'});
    }));
  });
  it('should fail an invalid post', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingPost({});
    }));
  });
  it('should fail an invalid remove', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingRemove({
        _id: 'mytest',
        _rev: rev
      })
    }));
  })
  it('should fail an invalid bulkDocs', async () => {
    // Also tests validatingBulkDocs with docs: [] property (which is
    // deprecated, but still supported).
    const resp = await db.validatingBulkDocs({
      docs: [
        {
          _id: 'test_invalid'
        }
      ]
    });
    checkError(resp[0]);
  });
});

describe('forbidden validation tests', () => {
  let rev;
  beforeEach(async () => {
    const data = await setupWithDoc();
    db = data.db;
    rev = data.rev;

    await db.put(onlyTestValidationDoc);
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('forbidden');
    err.message.should.equal("only a document named 'test' is allowed.");
  }

  it('should fail an invalid put', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingPut({_id: 'test_invalid'});
    }));
  });
  it('should fail an invalid post', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingPost({});
    }));
  });
  it('should fail an invalid remove', async () => {
    checkError(await shouldThrowError(async () => {
      await db.validatingRemove({
        _id: 'mytest',
        _rev: rev
      })
    }));
  });
  it('should fail an invalid bulk docs', async () => {
    const resp = await db.validatingBulkDocs([
      {
        _id: 'test_invalid'
      },
      {}
    ]);
    checkError(resp[0]);
    checkError(resp[1]);
  });
  it('should never fail a design doc', async () => {
    // A design doc is always valid, so no matter the validate_doc_update
    // function, the stuff below should succeed.
    (await db.validatingPut({
      _id: '_design/mytest'
    })).ok.should.be.ok;
  });
  it('should never fail a local doc', async () => {
    // A local doc is always valid, so no matter the validate_doc_update
    // function, the stuff below should succeed.
    await db.validatingPut({
      _id: '_local/mytest'
    });
  })
});

describe('compilation error validation tests', () => {
  beforeEach(() => {
    db = setup();
  });
  afterEach(teardown);

  function checkError(err) {
    err.name.should.equal('compilation_error')
    err.message.should.contain('Expression does not eval to a function.');
  }

  it('should fail syntax error', async () => {
    await db.put({
			"_id": "_design/test",
			"validate_doc_update": `function (newDoc, oldDoc, userCtx, secObj) {
				return;
			}324j3lkl;`
		});
    checkError(await shouldThrowError(async () => {
      await db.validatingPut({_id: 'test'});
    }));
  });

  it('should fail a non-function', async () => {
    await db.put({
      _id: '_design/test',
      validate_doc_update: "'a string instead of a function'"
    });

    checkError(await shouldThrowError(async () => {
      await db.validatingPut({_id: 'test'});
    }));
  });
});

describe('exception validation tests', () => {
  beforeEach(async () => {
    db = setup();

    await db.put({
      _id: '_design/test',
      validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
				//reference error
				test;
			}`
    })
  });
  afterEach(teardown);

  it('should fail for put()', async () => {
    const err = await shouldThrowError(async () => {
      await db.validatingPut({_id: 'test'});
    });
    err.name.should.equal('ReferenceError');
    //'test' is the name of the missing variable.
    err.message.should.contain('test')
  });
});

describe('attachment validation tests', () => {
  let rev;
  const forbiddenDesignDoc = {
    _id: '_design/test',
    validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
      throw({forbidden: JSON.stringify(newDoc)});
    }`
  }
  beforeEach(async () => {
    const info = await setupWithDocAndAttachment();
    db = info.db;
    rev = info.attRev;
  });
  afterEach(teardown);

  it('should succesfully remove an attachment', async () => {
    await db.validatingRemoveAttachment('attachment_test', 'text', rev);
  });
  it("shouldn't remove the attachment when forbidden", async () => {
    await db.put(forbiddenDesignDoc);
    const err = await shouldThrowError(async () => {
      await db.validatingRemoveAttachment('attachment_test', 'text', rev);
    });
    err.name.should.equal('forbidden');
    // checks if the newDoc argument is filled in correctly
    err.message.should.contain('"_attachments":{}');
  });
  it('should succesfully put an attachment', async () => {
    await db.validatingPutAttachment('attachment_test2', 'text', new Buffer('tést', 'UTF-8'), 'text/plain');
  });
  it("shouldn't put an attachment when forbidden", async () => {
    await db.put(forbiddenDesignDoc);
    const err = await shouldThrowError(async () => {
      await db.validatingPutAttachment('attachment_test2', 'text', new Buffer('tést', 'UTF-8'), 'text/plain');
    });
    err.name.should.equal('forbidden');
    // checks if the newDoc argument is filled in correctly
    err.message.should.contain('text/plain');
  });
});

describe('validation args tests', () => {
  let rev;
  beforeEach(async () => {
    const info = await setupWithDoc();
    db = info.db;
    rev = info.rev;
    await db.put({
      _id: '_design/test',
      validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
				throw({forbidden: JSON.stringify({
          newDoc: newDoc,
          oldDoc: oldDoc,
          userCtx: userCtx,
          secObj: secObj
        })});
			}`
    });
  });
  afterEach(teardown);

  it.skip('should have the right args with a new doc', async () => {
    const doc = {_id: 'test'};
    const err = await shouldThrowError(async () => {
      await db.validatingPut(doc);
    });
    const i = JSON.parse(err.message);
    i.newDoc.should.eql(doc);
    should.not.exist(i.oldDoc);

    i.userCtx.should.eql({
      db: 'test',
      name: null,
      roles: ['_admin']
    });
    i.secObj.should.eql({});
  });
  it('should have the right args with an existing doc', async () => {
    const doc = {_id: 'mytest', _rev: rev};
    const err = await shouldThrowError(async () => {
      await db.validatingPut(doc);
    });
    const i = JSON.parse(err.message);
    i.oldDoc.test.should.be.ok;
    i.oldDoc._revisions.should.have.property('ids');
    i.newDoc._revisions.should.have.property('ids');
  });
  it('should support changing the userCtx', async () => {
    const theUserCtx = {
      db: 'test',
      name: 'pypouchtest',
      roles: ['the_boss']
    }

    const err = await shouldThrowError(async () => {
      await db.validatingPost({}, {userCtx: theUserCtx});
    });
    const i = JSON.parse(err.message);
    i.userCtx.should.eql(theUserCtx);
  });
  it('should support changing the security object', async () => {
    const theSecObj = {
      admins: {
        names: ['the_boss'],
        roles: []
      },
      members: {
        names: [],
        roles: []
      }
    };

    const err = await shouldThrowError(async () => {
      await db.validatingPost({}, {secObj: theSecObj});
    });
    const i = JSON.parse(err.message);

    i.secObj.should.eql(theSecObj);
  });
});

describe('install validation methods tests', () => {
  beforeEach(async () => {
    db = setup();
    await db.put(onlyTestValidationDoc);
  });
  afterEach(teardown);

  it('basics should work', async () => {
    db.installValidationMethods();

    const err = await shouldThrowError(async () => {
      await db.put({_id: 'mytest'});
    });
    err.status.should.equal(403);

    db.uninstallValidationMethods();

    const resp = await db.put({_id: 'mytest'});
    resp.ok.should.be.ok;
  });
  it('should fail when installing twice', async () => {
    db.installValidationMethods();
    const err = await shouldThrowError(async () => {
      await db.installValidationMethods();
    });
    err.name.should.equal('already_installed');
  });
  it('should fail uninstalling when not installed', async () => {
    const err = await shouldThrowError(async () => {
      await db.uninstallValidationMethods();
    });
    err.name.should.equal('already_not_installed');
  });
  it('should support reinstalling methods', async () => {
    for (let i = 0; i < 2; i++) {
      db.installValidationMethods();
      db.uninstallValidationMethods();
    }
  });
});
