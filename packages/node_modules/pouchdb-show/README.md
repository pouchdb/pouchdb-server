pouchdb-show
============

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-show.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-show)
[![Dependency Status](https://david-dm.org/pouchdb/pouchdb-show.svg)](https://david-dm.org/pouchdb/pouchdb-show)
[![devDependency Status](https://david-dm.org/pouchdb/pouchdb-show/dev-status.svg)](https://david-dm.org/pouchdb/pouchdb-show#info=devDependencies)

A PouchDB plug-in that allows you to re-use your CouchDB show functions
on the client side. A browser version is available.

TODO: rst -> md, update & restructure
```rst
.. _pouchdb-show-plug-in:

PouchDB Show plug-in
====================
+----------------------+-----------------+
| NodeJS package name: | `pouchdb-show`_ |
+----------------------+-----------------+
| Browser object name: | ``window.Show`` |
+----------------------+-----------------+

First, make sure you understand how show functions work in CouchDB. A
good start is `the CouchDB guide entry on shows`_.

.. _pouchdb-show: https://www.npmjs.org/package/pouchdb-show
.. _the CouchDB guide entry on shows: http://guide.couchdb.org/draft/formats.html

.. js:function:: Show.show(showPath[, options[, callback]])

   Similar to the :js:func:`List.list` function, but then for show
   functions. Only differences are documented.

   :param string showPath: specifies the show (and optionally the
       document) to use. Has the following form:
       ``designDocName/showName[/docId]``

```
