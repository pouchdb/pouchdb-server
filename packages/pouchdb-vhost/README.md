pouchdb-vhost
=============

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-vhost.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-vhost)
[![Dependency Status](https://david-dm.org/pouchdb/pouchdb-vhost.svg)](https://david-dm.org/pouchdb/pouchdb-vhost)
[![devDependency Status](https://david-dm.org/pouchdb/pouchdb-vhost/dev-status.svg)](https://david-dm.org/pouchdb/pouchdb-vhost#info=devDependencies)

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
