pouchdb-security
================

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-server.svg?branch=master)](https://travis-ci.org/pouchdb/pouchdb-server)

PouchDB database access restrictions using a security document. Like
_security in CouchDB (and when used on an http database, that url is
checked.)

#TODO: port docs below to markdown, expand and update (the wrapper functions
#need to be documented!)
```reStructuredText
.. _pouchdb-security-plug-in:

PouchDB Security plug-in
========================
+----------------------+---------------------+
| NodeJS package name: | `pouchdb-security`_ |
+----------------------+---------------------+
| Browser object name: | ``window.Security`` |
+----------------------+---------------------+

First, make sure you understand how security objects work in CouchDB.
A good start is `their HTTP documentation`_.

.. _pouchdb-security: https://www.npmjs.org/package/pouchdb-security
.. _their HTTP documentation: http://docs.couchdb.org/en/latest/api/database/security.html

.. js:function:: Security.putSecurity(secObj[, callback])

   Equivalent to PUTting a document to /db/_security in CouchDB.
   Replaces the current security object for the database with the given
   one.

   :param object secObj: For example:

                         .. code-block:: javascript

                            {
                              "admins": {
                                "names": [
                                  "your_name"
                                ],
                                "roles": []
                              },
                              "members": {
                                "names": [],
                                "roles": [
                                  "app_users"
                                ]
                              }
                            }

   :returns: ``{ok: true}``

.. js:function:: Security.getSecurity([callback])

   Equivalent to going to /db/_security in CouchDB.

   :returns: the security object for the current database. ({} when none
             has been set, like in CouchDB.)
```

### Source

PouchDB Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages/node_modules).


# License
Apache-2.0
