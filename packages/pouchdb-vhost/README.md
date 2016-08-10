pouchdb-vhost
=============

A PouchDB plug-in that allows you to re-use your CouchDB vhost config on
the client side. A browser version is available.

#TODO: update, expand, rst -> md.
```rst
.. _pouchdb-vhost-plug-in:

PouchDB VirtualHost plug-in
===========================
+----------------------+------------------------+
| NodeJS package name: | `pouchdb-vhost`_       |
+----------------------+------------------------+
| Browser object name: | ``window.VirtualHost`` |
+----------------------+------------------------+

This plug-in is a single function which requires a ``PouchDB`` object as
its first argument. Following that, these extra methods become
available.

.. _pouchdb-vhost: https://www.npmjs.org/package/pouchdb-vhost

.. js:function:: PouchDB.virtualHost(req, vhosts[, options[, callback]])

.. js:function:: PouchDB.resolveVirtualHost(req, vhosts)
```

## Source

PouchDB-Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages).

## Contributing

If you want to become one of our [wonderful contributors](https://github.com/pouchdb/pouchdb-server/graphs/contributors), see the main [Readme](https://github.com/pouchdb/pouchdb-server/tree/master/README.md) for contributing.
