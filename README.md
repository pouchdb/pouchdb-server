pouchdb-size
============

[![Build Status](https://travis-ci.org/marten-de-vries/pouchdb-size.svg?branch=master)](https://travis-ci.org/marten-de-vries/pouchdb-size)
[![Dependency Status](https://david-dm.org/marten-de-vries/pouchdb-size.svg)](https://david-dm.org/marten-de-vries/pouchdb-size)
[![devDependency Status](https://david-dm.org/marten-de-vries/pouchdb-size/dev-status.svg)](https://david-dm.org/marten-de-vries/pouchdb-size#info=devDependencies)

Adds disk_size to info()'s output for your *down backed PouchDB's.

Tested with leveldown, sqldown, jsondown, locket and medeadown. When it
can't determine the database size, it falls back to the default
``info()`` output.

Example
-------

```bash
npm install pouchdb pouchdb-size
```

```javascript
//index.js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-size'));

var db = new PouchDB('test');
db.installSizeWrapper();
db.info().then(function (resp) {
	//resp will contain disk_size
})
```

API
---

- ``db.installSizeWrapper()``

  wraps ``db.info()`` in such a way that it will include a ``disk_size``
  property in its output for supported database backends.

- ``db.getDiskSize([callback])``

  like PouchDB, this method both returns a Promise and accepts a
  callback. Either returns an error or the disk size of the current db.
