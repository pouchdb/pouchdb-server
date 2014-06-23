# pouchdb-server

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
     -p, --port           Port on which to run the server.
     -d, --dir            Where to store database files (defaults to current directory)
     -m, --in-memory      Use a pure in-memory database (will be deleted upon restart!)
     -l, --log            Connect log format.
     -h, --help           Show this usage information.
     -u, --user           Set Basic Auth username. (Both user and pass required for Basic Auth).
     -s, --pass           Set Basic Auth password. (Both user and pass required for Basic Auth).

   Advanced Options:
     --level-backend      Alternate LevelDOWN backend (e.g. memdown, riakdown, redisdown)
                          Note that you'll need to manually npm install it first.
     --level-prefix       Prefix to use for all database names, useful for URLs in
                          alternate backends, e.g. riak://localhost:8087/ for riakdown
```

A simple example might be,

```bash
$ pouchdb-server -p 15984 -l tiny
pouchdb-server listening on port 15984.
```

Take a look at the possible log formats [here](http://www.senchalabs.org/connect/middleware-logger.html). 
Alternatively, **pouchdb-server**'s functionality can be mounted into other Express web apps. For more information
on that, check out [express-pouchdb](https://github.com/nick-thompson/express-pouchdb).

## Basic Auth

**pouchdb-server** supports a read-only authentication scheme with Basic Auth 
out of the box. Usage is simple:
```bash
$ pouchdb-server --user=nick --pass=secret &
$ curl -X PUT http://localhost:5984/test
PUT /test 401 4ms - 12b
Unauthorized.
$ curl --user nick:secret -X PUT http://localhost:5984/test
PUT /test 201 815ms - 16b
{
  "ok": true
}
```

If you need a more involved authentication option, it's encouraged that you mount
[express-pouchdb](https://github.com/nick-thompson/express-pouchdb) into a custom application.

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
I haven't defined a formal styleguide, so please take care to maintain the existing coding style.

## Contributors

A huge thanks goes out to all of the following people for helping me get this to where it is now.

* Dale Harvey ([@daleharvey](https://github.com/daleharvey))
* Ryan Ramage ([@ryanramage](https://github.com/ryanramage))
* Garren Smith ([@garrensmith](https://github.com/garrensmith))
* ([@copongcopong](https://github.com/copongcopong))
* ([@zevero](https://github.com/zevero))

## License

Copyright (c) 2013 Nick Thompson

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
