pouchdb-validation
==================

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-validation.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-validation)
[![Dependency Status](https://david-dm.org/pouchdb/pouchdb-validation.svg)](https://david-dm.org/pouchdb/pouchdb-validation)
[![devDependency Status](https://david-dm.org/pouchdb/pouchdb-validation/dev-status.svg)](https://david-dm.org/pouchdb/pouchdb-validation#info=devDependencies)

> A PouchDB plug-in that allows you to re-use your CouchDB validate_doc_update functions on the client side.

A browser version is available.

- [NodeJS package](https://www.npmjs.org/package/pouchdb-validation)
- Browser object name: ``window.validation``

First, make sure you understand how validation functions work in CouchDB. A good
start is [the CouchDB guide entry on validation functions](http://guide.couchdb.org/draft/validation.html).

Usage
-----

First, you need to register the plug-in with PouchDB. That can be done using the
``PouchDB.plugin()`` function. In NodeJS, you can just pass in the result of the
``require()`` function. In the browser, you pass in the browser object name
given above.

An example (using the list plug-in):

```javascript
//NodeJS (and Browserify)
PouchDB.plugin(require("pouchdb-validation"));

//Browser - after the JavaScript file containing the plug-in has been
//included via a script tag (or something similar).
PouchDB.plugin(Validation);
```

All functions have two ways of returning the output to the user. One is
a callback parameter, which should have the signature ``(err, resp)``.
The other is the Promise all functions return. PouchDB itself uses the
same system.

### db.validatingPut(doc[, options[, callback]])
Exactly the same as the ``db.put`` function, but checks with all validation
functions ('validate_doc_update') in all design documents of the current
database if it is ok to save ``doc``. In short, this method acts more like its
CouchDB equivalent than the original PouchDB version does. The only thing you
get to see of it is a few extra errors, i.e. of the 'unauthorized' or the
'forbidden' type. It also has a few extra ``options`` (defaults are shown):

- ``secObj``: e.g.:

  ```javascript
  {
     admins: {
        names: [],
        roles: []
     },
     members: {
        names: [],
        roles: []
     }
  }
  ```

- ``userCtx``: e.g.:

  ```javascript:
  {
     db: "test_db",
     name: "username",
     roles: [
        "_admin"
     ]
  }
  ```

- ``checkHttp``: Set this to ``true`` if you want to validate HTTP database
  documents offline too. Unnecessary for CouchDB, but handy for e.g.
  pouchdb-express-router, which doesn't validate itself.

### db.validatingPost(doc[, options[, callback]])

See the ``db.validatingPut()`` function.

### db.validatingRemove(doc[, options[, callback]])

See the ``db.validatingPut()`` function.

### db.validatingBulkDocs(bulkDocs[, options[, callback]])

See the ``db.validatingPut()`` function. Returns an array, like
``db.bulkDocs()``. The ``all_or_nothing`` attribute on ``bulkDocs`` is
unsupported. Also, the result array might not be in the same order as
the passed in documents.

### db.validatingPutAttachment(docId, attachmentId, rev, attachment, type[, options[, callback]])

See the ``db.validatingPut()`` function. Output is the same as
``db.putAttachment()`` (except for a few extra errors being possible.)

### db.validatingRemoveAttachment(docId, attachmentId, rev[, options[, callback]])

See the ``db.validatingPut()`` function. Output is the same as
``db.removeAttachment()`` (except for a few extra errors being possible.)

### db.installValidationMethods()

Installs the validation methods on this database. In other words, the ``db.*``
methods are replaced by their ``db.validating*`` counterparts. This method is
always synchronous.

**Throws**: an error if the methods are already installed.
**Returns**: nothing

### db.uninstallValidationMethods()

Undoes what ``db.installValidationMethods`` did. This method is always
synchronous.

**Throws**: an error if the methods aren't currently installed.
**Returns**: nothing

License
-------

Apache-2.0
