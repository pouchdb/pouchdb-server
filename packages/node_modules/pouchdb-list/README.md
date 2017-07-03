pouchdb-list
============

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-list.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-list)
[![Dependency Status](https://david-dm.org/pouchdb/pouchdb-list.svg)](https://david-dm.org/pouchdb/pouchdb-list)
[![devDependency Status](https://david-dm.org/pouchdb/pouchdb-list/dev-status.svg)](https://david-dm.org/pouchdb/pouchdb-list#info=devDependencies)

A PouchDB plug-in that allows you to re-use your CouchDB list functions
on the client side. A browser version is available.

TODO: integrate, update & make nice:
```rst
.. _pouchdb-list-plug-in:

PouchDB List plug-in
====================
+----------------------+-----------------+
| NodeJS package name: | `pouchdb-list`_ |
+----------------------+-----------------+
| Browser object name: | ``window.List`` |
+----------------------+-----------------+

First, make sure you understand how list functions work in CouchDB. A
good start is `the CouchDB guide entry on lists`_.

.. _pouchdb-list: https://www.npmjs.org/package/pouchdb-list
.. _the CouchDB guide entry on lists: http://guide.couchdb.org/draft/transforming.html

.. js:function:: List.list(listPath[, options[, callback]])

   Runs a list function on a view. Both are specified via the
   ``listPath`` parameter.

   :param string listPath: a url of the form
       ``"designDocName/listFuncName/viewName"``
   :param object options: this object is supplemented with defaults
       until a complete `CouchDB request object`_ has been formed, which
       is then passed into the list function.
   :returns: When succesful, the list function's result in the form of a
       `CouchDB response object`_. Otherwise, an error object with one
       of the following statuses: 400, 404, 406 or 500.

.. _CouchDB request object: http://docs.couchdb.org/en/latest/json-structure.html#request-object
.. _CouchDB response object: http://docs.couchdb.org/en/latest/json-structure.html#response-object
```
