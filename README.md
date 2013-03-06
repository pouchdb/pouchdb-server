# PouchDB-Server

>PouchDB HTTP support for Node.js.

* Allows for replication from idb to node.
* Allows the PouchDB team to run the extensive CouchDB test suite against PouchDB.
* Allows people to use a PouchDB as a mini-CouchDB replacement to get up and running.

See the discussion behind this project here: https://github.com/daleharvey/pouchdb/issues/175

## Installation

PouchDB-Server can be installed via npm,

```
npm install pouchdb-server
```

however, if you plan to use it for testing PouchDB, it's recommended that you
follow these steps,

```
git clone git://github.com/nick-thompson/pouchdb-server.git
cd pouchdb-server
npm link pouchdb
npm install
```

The above assumes that you have linked a local clone of the PouchDB repository
(from your local PouchDB repository, `npm link`).
This allows you to run the test suites against the development version of PouchDB,
rather than relying on the npm package to be constantly up-to-date.

## Usage

To run the server from the command line,

```
./bin/pouch [port]
```

or

```
./node_modules/pouchdb-server/bin/pouch [port]
```

depending on your install. By default, the server will run on port 5984, the
same port that CouchDB defaults to, for ease of testing.

To run the server via Node.js,

```
var server = require("pouchdb-server");
server.listen(5984);
```

## Testing

If you're interested in running the test suites, spin up an instance of pouchdb-server
from the command line, and then run the PouchDB test suite as you normally would.
Make sure that you have halted your CouchDB server so that the two are not competing
for the same port.

