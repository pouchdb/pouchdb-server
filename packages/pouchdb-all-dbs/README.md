PouchDB allDbs() plugin
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-all-dbs.svg)](https://travis-ci.org/nolanlawson/pouchdb-all-dbs)

This plugin exposes the `PouchDB.allDbs()` function, which you can use to list all local databases. It works by listening for `PouchDB.on('created')` and `PouchDB.on('destroyed')` events, and maintaining a separate database to store the names of those databases.

**Note**: `allDbs()` used to be part of PouchDB core (enabled using `PouchDB.enableAllDbs = true`). It was deprecated in PouchDB 2.0.0, and now lives on as a plugin.

Usage
-----

### In the browser

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.all-dbs.js"></script>
```

This plugin is also available from Bower:

```
bower install pouchdb-all-dbs
```

Merely including it as a script tag will work, assuming you also used a script tag for PouchDB.

### In Node/Browserify/Webpack/etc.

First, npm install it:

```
npm install pouchdb-all-dbs
```

And then do this:

```js
var PouchDB = require('pouchdb');
require('pouchdb-all-dbs')(PouchDB);
```

API
-----

#### PouchDB.allDbs([callback])

Returns a list of all non-deleted databases.  Example usage as a promise:

```js
PouchDB.allDbs().then(function (dbs) {
  // dbs is an array of strings, e.g. ['mydb1', 'mydb2']
}).catch(function (err) {
  // handle err
});
```

Or if you like callbacks, you can use that style instead:

```js
PouchDB.allDbs(function (err, dbs) {
  if (err) {
    // handle err
  }
  // dbs is an array of strings, e.g. ['mydb1', 'mydb2']
});
```

#### PouchDB.resetAllDbs([callback])

Destroys the separate allDbs database.  You should never need to call this function; I just use it for the unit tests.

Example usage:

```js
PouchDB.resetAllDbs().then(function () {
  // allDbs store is now destroyed
}).catch(function (err) {
  // handle err
});
```

Building
----
    npm install
    npm run build

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage


If you have mocha installed globally you can run single test with:
```
TEST_DB=local mocha --reporter spec --grep search_phrase
```

The `TEST_DB` environment variable specifies the database that PouchDB should use (see `package.json`).

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.
