pouchdb-size
============

Adds disk_size to info()'s output for your leveldown backed PouchDB's.

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

- db.installSizeWrapper()

- db.getDiskSize([callback])

  like PouchDB, this method both returns a Promise and accepts a
  callback. Either returns an error or the disk size of the current db.
