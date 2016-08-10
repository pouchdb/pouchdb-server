pouchdb-list
============

### Source

PouchDB-Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages).

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

## Contributing

If you want to become one of our [wonderful contributors](https://github.com/pouchdb/pouchdb-server/graphs/contributors), see the main [Readme](https://github.com/pouchdb/pouchdb-server/tree/master/README.md) for contributing.
