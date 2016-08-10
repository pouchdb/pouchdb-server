pouchdb-rewrite
===============

## Source

PouchDB-Server and its sub-packages are distributed as a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

For a full list of packages, see [the GitHub source](https://github.com/pouchdb/pouchdb-server/tree/master/packages).

## Usage

A PouchDB plug-in that allows you to re-use your CouchDB rewrites on the
client side. A browser version is available.

#TODO: update, rst -> md, integrate
```rst
.. _pouchdb-rewrite-plug-in:

PouchDB Rewrite plug-in
=======================
+----------------------+--------------------+
| NodeJS package name: | `pouchdb-rewrite`_ |
+----------------------+--------------------+
| Browser object name: | ``window.Rewrite`` |
+----------------------+--------------------+

First, make sure you understand CouchDB rewrites. A good starting point
is `the rewrite documentation`_.

.. _pouchdb-rewrite: https://www.npmjs.org/package/pouchdb-rewrite
.. _the rewrite documentation: http://docs.couchdb.org/en/latest/api/ddoc/rewrites.html

.. js:function:: Rewrite.rewrite(rewritePath[, options[, callback]])

   Figures out where to redirect to, and then executes the corresponding
   PouchDB function, with the appropriate arguments gotten from the
   request object that has been generated from the ``options``
   parameter.

   :param string rewritePath: a path of the form
       ``"designDocName/rewrite/path"``. Specifies the design document
       to use the rewrites from, and the path you'd find in CouchDB
       after the ``/_rewrite`` part of the URL. Keep in mind that you
       can't specify a query parameter in the url form (i.e. no
       ``?a=b``). Instead use the ``options.query`` parameter.
   :param object options: A CouchDB request object stub. Important
       properties of those for rewrites are ``options.query`` and
       ``options.method``. An additional boolean option is available:
       ``options.withValidation``, if true, this function routes to
       ``db.validating*`` functions instead of ``db.*`` functions if
       relevant.
   :returns: whatever output the function that the rewrite routed to
       produced. Or, in the case of an 'http' database, a CouchDB
       response object.

.. js:function:: Rewrite.rewriteResultRequestObject(rewritePath[, options[, callback]])

   See the :js:func:`Rewrite.rewrite` function for information on the
   parameters. The difference with it is that this function doesn't try
   to route the rewrite to a function.

   :returns: A CouchDB request object that points to the resource
       obtained by following the redirect.
```
## Contributing

If you want to become one of our [wonderful contributors](https://github.com/pouchdb/pouchdb-server/graphs/contributors), see the main [Readme](https://github.com/pouchdb/pouchdb-server/tree/master/README.md) for contributing.
