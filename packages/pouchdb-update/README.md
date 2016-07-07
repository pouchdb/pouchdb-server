pouchdb-update
==============

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-update.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-update)
[![Dependency Status](https://david-dm.org/pouchdb/pouchdb-update.svg)](https://david-dm.org/pouchdb/pouchdb-update)
[![devDependency Status](https://david-dm.org/pouchdb/pouchdb-update/dev-status.svg)](https://david-dm.org/pouchdb/pouchdb-update#info=devDependencies)

A PouchDB plug-in that allows you to re-use your CouchDB update
functions on the client side. A browser version is available.

TODO: convert the following to markdown + update + make nicer
```rst
.. _pouchdb-update-plug-in:

PouchDB Update plug-in
======================
+----------------------+-------------------+
| NodeJS package name: | `pouchdb-update`_ |
+----------------------+-------------------+
| Browser object name: | ``window.Update`` |
+----------------------+-------------------+

First, make sure you understand how update handlers work in CouchDB. A
good start is `the wiki entry on update handlers`_.

.. _pouchdb-update: https://www.npmjs.org/package/pouchdb-update
.. _the wiki entry on update handlers: https://wiki.apache.org/couchdb/Document_Update_Handlers

.. js:function:: Update.update(updatePath[, options[, callback]])

   Runs the update function specified by ``updatePath``, saving part of
   its result in the database and returning the other part in the form
   of a CouchDB response object.

   :param string updatePath: has the following form:
       ``"designDocName/updateHandlerName[/docId]"``. The last being
       optional, like in CouchDB.
   :param object options: a request object stub. There's also
       ``options.withValidation``, if true, this function saves the
       update handler result using the
       :js:func:`Validation.validatingPut` function instead of using the
       :js:func:`PouchDB.prototype.put` function.
```
