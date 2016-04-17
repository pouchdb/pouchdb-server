# express-pouchdb

[![Build Status](https://travis-ci.org/pouchdb/express-pouchdb.svg)](https://travis-ci.org/pouchdb/express-pouchdb)

> An Express submodule with a CouchDB style REST interface to PouchDB.

## Introduction

The **express-pouchdb** module is a fully qualified [Express](http://expressjs.com/) application with routing defined to
mimic most of the [CouchDB](http://couchdb.apache.org/) REST API, and whose behavior is handled by
[PouchDB](http://pouchdb.com/). The intention is for **express-pouchdb** to be mounted into other Express apps for
extended usability. A simple example of this is [pouchdb-server](https://github.com/nick-thompson/pouchdb-server),
which is primarily used as a quick-and-dirty drop-in replacement for CouchDB in Node.js.

## Screencasts

* [Modular web applications with Node.js and Express](http://vimeo.com/56166857)

## Installation

```bash
$ npm install express-pouchdb pouchdb express
```

## Example Usage

Here's a sample Express app, which we'll name `app.js`.

```javascript
var express = require('express'),
    app     = express(),
    PouchDB = require('pouchdb');

app.use('/db', require('express-pouchdb')(PouchDB));

app.listen(3000);
```

Now we can run this little guy and find each of `express-pouchdb`'s routes at the `/db` prefix.

```bash
$ node app.js &
$ curl http://localhost:3000/db/
GET / 200 56 - 7 ms
{
  "express-pouchdb": "Welcome!",
  "version": "0.2.0"
}
```

*Note:* **express-pouchdb** conflicts with some middleware. You can work
around this by only enabling affected middleware for routes not handled
by **express-pouchdb**. [body-parser](https://www.npmjs.com/package/body-parser)
is the most important middleware known to be problematic.

## API

**express-pouchdb** exports a single function that builds an express [application object](http://expressjs.com/4x/api.html#application). Its function signature is:

``require('express-pouchdb')([PouchDB[, options]])``
- ``PouchDB``: the PouchDB object used to access databases. Optional.
- ``options``: Optional. These options are supported:
 - ``configPath``: a path to the configuration file to use. Defaults to './config.json'.
 - ``mode``: determines which parts of the HTTP API express-pouchdb offers are enabled. There are three values:
   - ``'fullCouchDB'``: enables every part of the HTTP API, which makes express-pouchdb very close to a full CouchDB replacement. This is the default.
    - ``'minimumForPouchDB'``: just exposes parts of the HTTP API that map 1-1 to the PouchDB api. This is the minimum required to make the PouchDB test suite run, and a nice start when you just need an HTTP API to replicate with.
    - ``'custom'``: no parts of the HTTP API are enabled. You can add parts yourself using the ``opts.overrideMode`` discussed below.
  - ``overrideMode``: Sometimes the preprogrammed modes are insufficient for your needs, or you chose the ``'custom'`` mode. In that case, you can set this to an object. This object can have the following properties:
    - ``'include'``: a javascript array that specifies parts to include on top of the ones specified by ``opts.mode``. Optional.
    - ``'exclude'``: a javascript array that specifies parts to exclude from the ones specified by ``opts.mode``. Optional.

The application object returned contains some extra properties that
offer additional functionality compared to an ordinary express
application:
- ``setPouchDB``: a function that allows changing the ``PouchDB`` object **express-pouchdb** uses on the fly. Takes one argument: the new ``PouchDB`` object to use.
- ``couchConfig``: an object that provides programmatic access to the configuration file and HTTP API express-pouchdb offers. For an overview of available configuration options, take a look at Fauxton's configuration page. (``/_utils#_config``)
- ``couchLogger``: an object that provides programmatic access to the log file and HTTP API **express-pouchdb** offers.

### Examples

#### Example 1

Builds an HTTP API that exposes a minimal HTTP interface, but adds
Fauxton as a debugging tool.

```javascript
var app = require('express-pouchdb')({
  mode: 'minimumForPouchDB',
  overrideMode: {
    include: ['routes/fauxton']
  }
});
// when not specifying PouchDB as an argument to the main function, you
// need to specify it like this before requests are routed to ``app``
app.setPouchDB(require('pouchdb'));
```

#### Example 2

builds a full HTTP API but excludes express-pouchdb's authentication
logic (say, because it interferes with custom authentication logic used
in our own express app):

```javascript
var app2 = require('express-pouchdb')(require('pouchdb'), {
  mode: 'fullCouchDB', // specified for clarity. It's the default so not necessary.
  overrideMode: {
    exclude: [
      'routes/authentication',
      // disabling the above, gives error messages which require you to disable the
      // following parts too. Which makes sense since they depend on it.
      'routes/authorization',
      'routes/session'
    ]
  }
});
```

### Using your own PouchDB

Since you pass in the `PouchDB` that you would like to use with
express-pouchb, you can drop express-pouchdb into an existing Node-based
PouchDB application and get all the benefits of the HTTP interface
without having to change your code.

```js
var express = require('express')
  , app     = express()
  , PouchDB = require('pouchdb');

app.use('/db', require('express-pouchdb')(PouchDB));

var myPouch = new PouchDB('foo');

// myPouch is now modifiable in your own code, and it's also
// available via HTTP at /db/foo
```

### PouchDB defaults

When you use your own PouchDB code in tandem with **express-pouchdb**, the `PouchDB.defaults()` API can be very convenient for specifying some default settings for how PouchDB databases are created.

For instance, if you want to use an in-memory [MemDOWN](https://github.com/rvagg/memdown)-backed pouch, you can simply do:

```js
var InMemPouchDB = PouchDB.defaults({db: require('memdown')});

app.use('/db', require('express-pouchdb')(InMemPouchDB));

var myPouch = new InMemPouchDB('foo');
```

Similarly, if you want to place all database files in a folder other than the `pwd`, you can do:

```js
var TempPouchDB = PouchDB.defaults({prefix: '/tmp/my-temp-pouch/'});

app.use('/db', require('express-pouchdb')(TempPouchDB));

var myPouch = new TempPouchDB('foo');
```

If you want express-pouchdb to proxy requests to another CouchDB-style
HTTP API, you can use [http-pouchdb](https://www.npmjs.com/package/http-pouchdb):

```javascript
var TempPouchDB = require('http-pouchdb')(PouchDB, 'http://localhost:5984');
app.use('/db', require('express-pouchdb')(TempPouchDB));
```

## Functionality

On top of the exposing everything PouchDB offers through a CouchDB-like
interface, **express-pouchdb** also offers the following extra
functionality found in CouchDB but not in PouchDB by default (depending
on the mode used, of course):

- [Fauxton][], a web interface for the HTTP API.
- [Authentication][] and [authorisation][] support. HTTP basic
  authentication and cookie authentication are available. Authorisation
  is handled by [validation functions][] and [security documents][].
- [Configuration][] support. You can modify configuration values
  manually in the `config.json` file, or use the HTTP or Fauxton
  interface.
- [Replicator database][] support. This allows your replications to
  persist past a restart of your application.
- Support for [show][], [list][] and [update][] functions. These allow
  you to serve non-json content straight from your database.
- [Rewrite][] and [Virtual Host][] support, for nicer urls.

[fauxton]:              https://www.npmjs.com/package/fauxton
[authentication]:       http://docs.couchdb.org/en/latest/intro/security.html
[authorisation]:        http://docs.couchdb.org/en/latest/intro/overview.html#security-and-validation
[validation functions]: http://docs.couchdb.org/en/latest/couchapp/ddocs.html#vdufun
[security documents]:   http://docs.couchdb.org/en/latest/api/database/security.html
[configuration]:        http://docs.couchdb.org/en/latest/config/intro.html#setting-parameters-via-the-http-api
[replicator database]:  http://docs.couchdb.org/en/latest/replication/replicator.html
[show]:                 http://guide.couchdb.org/editions/1/en/show.html
[list]:                 http://guide.couchdb.org/editions/1/en/transforming.html
[update]:               http://docs.couchdb.org/en/latest/couchapp/ddocs.html#update-functions
[rewrite]:              http://docs.couchdb.org/en/latest/api/ddoc/rewrites.html
[virtual host]:         http://docs.couchdb.org/en/latest/config/http.html#vhosts

## Contributors

If you want to become one of our [wonderful contributors](https://github.com/pouchdb/express-pouchdb/graphs/contributors)
then check out the [contributing guide](https://github.com/pouchdb/express-pouchdb/blob/master/CONTRIBUTING.md)!

## License

The MIT License. See [the LICENSE file](https://github.com/pouchdb/express-pouchdb/blob/master/LICENSE) for more information.
