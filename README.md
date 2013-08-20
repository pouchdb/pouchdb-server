# pouchdb-server

> A standalone REST interface server for PouchDB.

## Introduction

**pouchdb-server** is a simple Node.js server that presents a simple REST API, which mimics that of [CouchDB](couchdb.apache.org),
on top of [PouchDB](pouchdb.com). Among other things, this allows users to replicate IndexedDB stores to LevelDB, or to
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
     -l, --log            Connect log format.
     -h, --help           Show this usage information.


```

A simple example might be,

```bash
$ pouchdb-server -p 15984 -l tiny
pouchdb-server listening on port 15984.
```

Take a look at the possible log formats [here](http://www.senchalabs.org/connect/middleware-logger.html). 
Alternatively, **pouchdb-server**'s functionality can be mounted into other Express web apps. For more information
on that, check out [express-pouchdb](https://github.com/nick-thompson/express-pouchdb).

## Testing

One of the primary benefits of **pouchdb-server** is the ability to run PouchDB's Node test suite against itself.
To do that, you can simply,

```bash
$ pouchdb-server &
$ grunt test:pouchdb
```

Additionally, we've started porting CouchDB's JavaScript test harness to 
[a simple Node module](https://github.com/nick-thompson/couchdb-harness), which can be run against PouchDB via
**pouchdb-server**.

```bash
$ pouchdb-server &
$ grunt test:couchdb
```

**Note**, you can also specify specific test files to run from CouchDB's harness: `$ grunt test:couchdb:basics:all_docs`

## Contributing

Want to help me make this thing awesome? Great! Your pull requests are always
welcome. In lieu of a formal styleguide, please take care to maintain the existing coding style.

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
