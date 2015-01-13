pouchdb-seamless-auth
=====================

Seamless switching between online (CouchDB) and offline (PouchDB)
authentication.

**WARNING**: This plug-in stores password hashes in a local PouchDB. In
for example internet cafes, this is not a smart thing to do. In your
app, you should include a checkbox 'I trust this computer' and only use
**pouchdb-seamless-auth** when it is checked. Otherwise, you can fall
back to **pouchdb-auth**. This functionality might be implemented as
part of the plug-in in the future.

See also [pouchdb-seamless-auth's documentation](http://pythonhosted.org/Python-PouchDB/js-plugins.html#pouchdb-seamless-auth-plug-in)

[Website of this plug-in and a few others](http://python-pouchdb.marten-de-vries.nl/plugins.html)
