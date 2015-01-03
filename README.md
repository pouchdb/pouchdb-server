# pouchdb-server
[![Build Status](https://travis-ci.org/pouchdb/pouchdb-server.svg)](https://travis-ci.org/pouchdb/pouchdb-server)

> A standalone REST interface server for PouchDB.

## Introduction

**pouchdb-server** is a simple Node.js server that presents a simple REST API, which mimics that of [CouchDB](http://couchdb.apache.org),
on top of [PouchDB](http://pouchdb.com). Among other things, this allows users to replicate IndexedDB stores to LevelDB, or to
spin up a quick and dirty drop-in replacement for CouchDB to get things moving quickly.

## Installation

```bash
$ npm install -g pouchdb-server
```

## Usage

```

Usage: pouchdb-server [options]

Options:
   -p, --port        Port on which to run the server. (Defaults to
                     /_config/httpd/port which defaults to 5984).
   -d, --dir         Where to store database files. (Defaults to
                     /_config/couchdb/database_dir which defaults to the
                     current directory).
   -c, --config      The location of the configuration file that backs
                     /_config. (Defaults to ./config.json).
   -o, --host        The address to bind the server to. (Defaults to
                     /_config/httpd/bind_address which defaults to 127.0.0.1).
   -m, --in-memory   Use a pure in-memory database which will be deleted upon
                     restart. (Defaults to /_config/pouchdb_server/in_memory
                     which defaults to false).
   -r, --proxy       Proxy requests to the specified host. Include a trailing
                     '/'. (Defaults to /_config/pouchdb_server/proxy which
                     defaults to undefined).
   --no-color        Disable coloring of logging output.
   --level-backend   Advanced - Alternate LevelDOWN backend (e.g. memdown,
                     riakdown, redisdown). Note that you'll need to manually
                     npm install it first. (Defaults to
                     /_config/pouchdb_server/level_backend which defaults to
                     undefined).
   --level-prefix    Advanced - Prefix to use for all database names, useful
                     for URLs in alternate backends, e.g.
                     riak://localhost:8087/ for riakdown. (Defaults to
                     /_config/pouchdb_server/level_prefix which defaults to
                     undefined).

Examples:

  pouchdb-server --level-backend riakdown --level-prefix riak://localhost:8087
  Starts up a pouchdb-server that talks to Riak.

  pouchdb-server --level-backend redis
  Starts up a pouchdb-server that talks to Redis, on localhost:6379

  pouchdb-server --level-backend sqldown --level-prefix /tmp/
  Starts up a pouchdb-server that uses SQLite, with db files stored in /tmp/
```

A simple example might be,

```bash
$ pouchdb-server -p 15984
pouchdb-server listening on port 15984.
```

Alternatively, **pouchdb-server**'s functionality can be mounted into other Express web apps. For more information
on that, check out [express-pouchdb](https://github.com/nick-thompson/express-pouchdb).

## Fauxton

**pouchdb-server** currently supports an experimental version of CouchDB's [Fauxton](http://docs.couchdb.org/en/latest/fauxton/index.html). Fauxton, the successor to CouchDB's original Futon, is a simple web UI for interacting with your databases. With your server running, navigate to `/_utils` to check it out!

## Testing

One of the primary benefits of **pouchdb-server** is the ability to run PouchDB's Node test suite against itself. To do that, you can simply,

```bash
$ npm run test-pouchdb
```

Whatever args you provide as `SERVER_ARGS` will be passed to `pouchdb-server` itself:

```bash
$ SERVER_ARGS='--in-memory' npm run test-pouchdb
```

Or to test in Firefox (IndexedDB):

```bash
$ CLIENT=selenium:firefox npm run test-pouchdb
```

Or to test in PhantomJS (WebSQL):

```bash
$ CLIENT=selenium:phantomjs ES5_SHIM=true npm run test-pouchdb
```

Additionally, we've started porting CouchDB's JavaScript test harness to 
[a simple Node module](https://github.com/nick-thompson/couchdb-harness), which can be run against PouchDB via **pouchdb-server**.

```bash
$ npm run test-couchdb
```

## Contributing

Want to help me make this thing awesome? Great! Here's how you should get started.

1. First, make sure that the bugfix or feature you're looking to implement isn't better fit for [express-pouchdb](https://github.com/nick-thompson/express-pouchdb).
2. PouchDB is still developing rapidly. If you need bleeding egde versions, you should first read how to [set up express-pouchdb for local development](https://github.com/nick-thompson/express-pouchdb#contributing). (Make sure that, afterwards, you `npm link` express-pouchdb).
3. Go ahead and fork **pouchdb-server**, clone it to your machine.
4. Now you'll want to, from the root of **pouchdb-server**, `npm link express-pouchdb`.
5. `npm install` the rest of the dependencies.

Please make your changes on a separate branch whose name reflects your changes, push them to your fork, and open a pull request!

For commit message style guidelines, please refer to [PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

## Contributors

[These people](https://github.com/pouchdb/express-pouchdb/graphs/contributors) made **pouchdb-server** into what it is today!

## License

The MIT License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
