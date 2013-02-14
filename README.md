[https://github.com/daleharvey/pouchdb/issues/175](https://github.com/daleharvey/pouchdb/issues/175)

This server assumes you have a local clone of the PouchDB repository itself.
You will need to create a symlink to that clone from within the pouch-server
folder:

```
ln -s ../path/to/pouchdb pouchdb
```

CLI:
```
./bin/pouch [port]
```

Node:
```
var server = require("pouch-server");
server.listen(5984);
```
