import {setup, teardown, showDocument, shouldThrowError, should, checkUserAgent, checkUuid} from './utils';

let db;

describe('Sync show tests', () => {
  beforeEach(async () => {
    db = setup();
    await db.put(showDocument);
  });
  afterEach(teardown);

  it('should fail when given an invalid response object', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/invalidRespObject');
    });
    err.status.should.equal(500);
    err.name.should.equal('external_response_error');
    err.message.should.equal('Invalid data from external server: {<<"abc">>,<<"test">>}');
  });

  it('show without doc with a browser-like env', async () => {
    global.window = {navigator: require('navigator')};

    const result = await db.show('test/myshow');
    result.code.should.equal(200);

    delete global.window;
  });

  it('invalid return type and provides', async () => {
    const result = await db.show('test/invalidReturnTypeAndProvides');
    result.code.should.equal(200);
    result.body.should.equal('');
  });

  it('throwing error', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/throwingError');
    });
    err.status.should.equal(500);
  });

  it('throwing error in provides', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/throwingErrorInProvides');
    });
    err.status.should.equal(500);
  });

  it('show without doc', async () => {
    const result = await db.show('test/myshow');
    result.code.should.equal(200);
    result.headers['Content-Type'].should.equal('text/html; charset=utf-8');
    result.headers.Vary.should.equal('Accept');
    result.body.should.equal('no doc');
  });

  it('show with doc', async () => {
    await db.post({_id: 'mytest', description: 'Hello World!'});

    const result = await db.show('test/myshow/mytest');
    result.body.should.equal('Hello World!');
  });

  it('overwrite args', async () => {
    const resp = await db.show('test/args', {method: 'POST'});
    const req = JSON.parse(resp.body).args[1];
    req.method.should.equal('POST');
  });

  it('overwrite header', async () => {
    const resp = await db.show('test/args', {headers: {Host: 'example.com'}});
    const req = JSON.parse(resp.body).args[1];
    // check if the header update was succesful.
    req.headers.Host.should.equal('example.com');
    // check if other headers (test subject is Accept) are still set.
		req.headers.Accept.should.equal('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  });

  it('show args', async () => {
    const [doc, req] = JSON.parse((await db.show('test/args')).body).args;

    // test doc - well, the unavailability of it...
    should.equal(doc, null);

    // test request object
    req.body.should.equal('undefined');
    req.cookie.should.eql({});
    req.form.should.eql({});

    req.headers.Host.should.equal('localhost:5984');
    req.headers.Accept.should.equal('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    req.headers['Accept-Language'].should.contain('en');
    req.headers['Accept-Language'].should.contain('en-us');
    checkUserAgent(req.headers['User-Agent']);

    should.equal(req.id, null);
    req.info.db_name.should.equal('test');
    req.info.should.have.property('update_seq');
    req.method.should.equal('GET');
    req.path.should.eql(['test', '_design', 'test', '_show', 'args']);
    req.peer.should.equal('127.0.0.1');
    req.query.should.eql({});
    req.raw_path.should.equal('/test/_design/test/_show/args');
    req.requested_path.should.eql(['test', '_design', 'test', '_show', 'args']);
    req.secObj.should.eql({});
    req.userCtx.should.eql({
      db: 'test',
      name: null,
      roles: [
        '_admin'
      ]
    });
    checkUuid(req.uuid);
  });

  it('unexisting doc', async () => {
    const [doc, req] = JSON.parse((await db.show('test/args/abc')).body).args;
    should.equal(doc, null);
    req.id.should.equal('abc');
    req.path.should.contain('abc');
  });

  it('with design doc as arg', async () => {
    const resp = await db.show('test/args/_design/test');
    const [doc, req] = JSON.parse(resp.body).args;
    req.id.should.equal('_design/test');
    req.raw_path.should.equal('/test/_design/test/_show/args/_design/test');
    doc.should.have.property('shows');
  });

  it('with fake design doc as arg', async () => {
    const resp = await db.show('test/args/_design');
    const [doc, req] = JSON.parse(resp.body).args;
    should.equal(doc, null);
    req.id.should.equal('_design');
    req.raw_path.should.equal('/test/_design/test/_show/args/_design');
  });

  it('setting query', async () => {
    const resp = await db.show('test/args', {query: {a: 1}});
    const [doc, req] = JSON.parse(resp.body).args;
    should.equal(doc, null);
    req.raw_path.slice(-4).should.equal('?a=1');
    req.requested_path.should.eql(['test', '_design', 'test', '_show', 'args?a=1']);
    req.path.should.eql(['test', '_design', 'test', '_show', 'args']);
  });

  it('setting form', async () => {
    const resp = await db.show('test/args', {form: {a: 1}});
    const [doc, req] = JSON.parse(resp.body).args;
    should.equal(doc, null);
    req.body.should.equal('a=1');
    req.headers['Content-Type'].should.equal('application/x-www-form-urlencoded');
    req.headers['Content-Length'].should.equal('3');
    req.method.should.equal('POST');
  });

  it('unexisting design doc', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('abc/args');
    });
    err.name.should.equal('not_found');
    err.message.should.equal('missing');
  });

  it('unexisting show function', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/unexisting-show');
    });
    err.status.should.equal(404);
    err.name.should.equal('not_found');
    err.message.should.equal("missing show function unexisting-show on design doc _design/test");
  });

  it('providers default', async () => {
    const resp = await db.show('test/usingProviders');
    resp.code.should.equal(200);
    resp.body.should.equal('<h1>Hello World!</h1>');
    resp.headers['Content-Type'].should.equal('text/html; charset=utf-8');
    resp.headers.Vary.should.equal('Accept');
  });

  it('providers format', async () => {
    const resp = await db.show('test/usingProviders', {query: {format: 'json'}});
    resp.code.should.equal(200);
    JSON.parse(resp.body).should.eql({message: 'Hello World!'});
    resp.headers['Content-Type'].should.equal('application/json');
    resp.headers.Vary.should.equal('Accept');
  });

  it('providers accept header', async () => {
    const resp = await db.show('test/usingProviders', {
      headers: {Accept: 'text/css,*/*;q=0.1'}
    });
    resp.body.should.equal("body {content: 'Hello World!'}");
    resp.headers['Content-Type'].should.equal('text/css');
  });

  it('custom provider', async () => {
    const resp = await db.show('test/usingProviders', {
      headers: {Accept: 'application/octet-stream'}
    });
    resp.code.should.equal(200);
    resp.should.not.have.property('body');
    new Buffer(resp.base64, 'base64').toString('ascii').should.equal('Hello World!');
    resp.headers['Content-Type'].should.equal('application/octet-stream; charset=ascii');
  });

  it('unexisting format', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/usingProviders', {query: {format: 'text'}});
    });
    err.status.should.equal(500);
    err.name.should.equal('render_error');
    err.message.should.equal("the format option is set to 'text', but there's no provider registered for that format.");
  });

  it('no matching provider', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/usingProviders', {headers: {Accept: 'text/plain'}});
    });
    err.status.should.equal(406);
    err.name.should.equal('not_acceptable');
    err.message.indexOf("Content-Type(s) text/plain not supported, try one of: ").should.equal(0);
    err.message.should.contain('application/json');
  });

  it('old style json', async () => {
    const resp = await db.show('test/oldStyleJson');
    resp.headers['Content-Type'].should.equal('application/json');
    JSON.parse(resp.body).should.eql({old_style: 'json'});
  });

  it('format when empty show function', async () => {
    const resp = await db.show('test/empty');
    resp.code.should.equal(200);
    resp.headers['Content-Type'].should.equal('text/html; charset=utf-8');
    resp.body.should.equal('');
  });

  it('no function', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/nofunc');
    });
    err.status.should.equal(500);
    err.name.should.equal('compilation_error');
  });

  it('invalid syntax', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/invalidsyntax');
    });
    err.status.should.equal(500);
    err.name.should.equal('compilation_error');
  });

  it('no doc with error response', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/throwingError/some-doc');
    });
    err.status.should.equal(404);
    err.name.should.equal('not_found');
    err.message.should.equal('document not found');
  });
});

describe('Sync show tests with empty design doc', () => {
  beforeEach(async () => {
    db = setup();
    await db.put({_id: '_design/test'});
  });
  afterEach(teardown);
  it('test', async () => {
    const err = await shouldThrowError(async () => {
      await db.show('test/test/test');
    });
    err.status.should.equal(404);
  });
});

describe('async show tests', () => {
  beforeEach(done => {
    db = setup();
    db.put(showDocument, done);
  });
  afterEach(teardown);

  it('should work without doc', done => {
    db.show('test/myshow', (err, result) => {
      result.body.should.equal('no doc');
      done(err);
    });
  });
  it('should fail with an unexisting ddoc', done => {
    db.show('abc/args', err => {
      err.name.should.equal('not_found');
      err.message.should.equal('missing');
      done();
    });
  });
});
