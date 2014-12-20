http-pouchdb
============

[![Build Status](https://travis-ci.org/marten-de-vries/http-pouchdb.svg?branch=master)](https://travis-ci.org/marten-de-vries/http-pouchdb)
[![Dependency Status](https://david-dm.org/marten-de-vries/http-pouchdb.svg)](https://david-dm.org/marten-de-vries/http-pouchdb)
[![devDependency Status](https://david-dm.org/marten-de-vries/http-pouchdb/dev-status.svg)](https://david-dm.org/marten-de-vries/http-pouchdb#info=devDependencies)

Access remote CouchDB databases like you would access your local PouchDB
ones. Tested support for ``new PouchDB('name')``,
``PouchDB.replicate('name', 'name')``, ``PouchDB.destroy('name')`` and,
as a bonus, ``PouchDB.allDbs()``.

Example
-------

```bash
npm install pouchdb http-pouchdb
```

```javascript
var PouchDB = require('pouchdb');
var HTTPPouchDB = require('http-pouchdb')(PouchDB, 'http://localhost:5984');

var db = new HTTPPouchDB('_users');
console.log(HTTPPouchDB.isHTTPPouchDB) //-> true
// 'db' will be backed by http://localhost:5984/_users ; You can use it
// like any PouchDB database.
```

Browser usage
-------------

```html
<script src='somewhere/pouchdb.min.js'></script>
<script src='dist/http-pouchdb.min.js'></script>
<script>
  var HTTPPouchDB = buildHTTPPouchDB(PouchDB, 'http://localhost:5984/test');
  // use HTTPPouchDB as above.
</script>
```

API
---

- ``module.exports = function (PouchDB, name, opts) -> PouchDB2``
 - ``name``: The base url you want to use. Needs a trailing '/'.
 - ``opts``: ``opts.headers`` and ``opts.auth``.
