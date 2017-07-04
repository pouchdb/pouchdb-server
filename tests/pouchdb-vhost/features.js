/*
  Based on: https://github.com/apache/couchdb/blob/5c94e815e60dc53db735243e0d532b03bbe319c3/test/etap/160-vhosts.t

  Doesn't include the following subtests:

  - doesn't make any sense in the current context:
    - test_vhost_request_with_global()
    - test_vhost_request_with_oauth
  - an undocumented part of the api that can be duplicated with rewrites
    - test_vhost_request_path1
    - test_vhost_request_path2
    - test_vhost_request_path3
  - double with 'regular request'?
    - test_vhost_request_to_root
  - double with 'vhost request'
    - testVHostRequestPath
*/

const {setup, teardown, PouchDB} = require('./utils');

describe('sync vhost tests', () => {
  let db;
  const vhosts = {
    'example.com': '/test',
    '*.example.com': '/test/_design/doc1/_rewrite',
    'example.com/test': '/test',
    'example1.com': '/test/_design/doc1/_rewrite/',
    ':appname.:dbname.example1.com': '/:dbname/_design/:appname/_rewrite/',
    ':dbname.example1.com': '/:dbname',
    '*.example2.com': '/*',
    '*.example2.com/abc': '/*',
    '*/abc': '/test/_design/doc1/_show/test',
    'example3.com': '/'
  };

  beforeEach(() => {
    db = setup();

    return Promise.all([
      db.put({value: 666}, 'doc1'),
      db.put({
        shows: {
          test: `function (doc, req) {
            return {
              json: {
                requested_path: '/' + req.requested_path.join('/'),
                path: '/' + req.path.join('/')
              }
            };
          }`
        },
        rewrites: [{
          from: '/',
          to: '_show/test'
        }]
      }, '_design/doc1')
    ]);
  });
  afterEach(teardown);

  function vhost(req) {
    req.raw_path = req.raw_path || '/';
    return PouchDB.virtualHost(req, vhosts);
  }
  function resolve(req) {
    req.raw_path = req.raw_path || '/';
    return PouchDB.resolveVirtualHost(req, vhosts);
  }

  it('regular request', () => {
    // with no host headers, no vhost should be used
    return resolve({}).should.equal('/');
  });

  it('vhost request', () => {
    return vhost({headers:{host: 'example.com'}})

    .then((resp) => {
      resp.should.have.property('db_name');
    });
  });

  it('vhost request with QS', () => {
    return vhost({raw_path: '/doc1?revs_info=true', headers: {host: 'example.com'}})

    .then((resp) => {
      resp.should.have.property('_revs_info');
    });
  });

  it('vhost requested path', () => {
    return vhost({headers: {host: 'example1.com'}})

    .then((resp) => {
      resp.json.requested_path.should.equal('/');
    });
  });

  it('vhost requested path path', () => {
    return vhost({headers: {Host: 'example1.com'}})

    .then((resp) => {
      resp.json.path.should.equal('/test/_design/doc1/_show/test');
    });
  });

  it('vhost request with wildcard', () => {
    return vhost({headers: {host: 'test.example.com'}})

    .then((resp) => {
      resp.json.path.should.equal('/test/_design/doc1/_show/test');
    });
  });

  it('vhost request replace var', () => {
    return vhost({headers: {host: 'test.example1.com'}})

    .then((resp) => {
      resp.should.have.property('db_name');
    });
  });

  it('vhost request replace var1', () => {
    return vhost({headers: {Host: 'doc1.test.example1.com'}})

    .then((resp) => {
      resp.json.path.should.equal('/test/_design/doc1/_show/test');
    });
  });

  it('vhost request replace wildcard', () => {
    return vhost({headers: {host: 'test.example2.com'}})

    .then((resp) => {
      resp.should.have.property('db_name');
    });
  });
});
