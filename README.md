# PouchDB-Server

>PouchDB HTTP support for Node.js.

* Replicate PouchDB stores from idb to node.
* Use PouchDB as a mini CouchDB replacement to get up and running quickly.
* Allows the PouchDB team to run the extensive CouchDB test suite against PouchDB.

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

### Command Line

If you've installed the package globally, you can run the server with,

```
pouchdb-server [port]
```

Otherwise you can run the server with `npm start` from the root directory of
your installation.

By default, the server will run on port 5984, the same port that CouchDB 
defaults to, for ease of testing.

### Node.js

It is not invoked like this

```
var server = require("pouchdb-server");
server.listen(5984);
```

but like this

```
var express  = require('express'),
    app = express();
    pouchdb_server = require("pouchdb-server");
    
app.use('/your_prefix_for_pouchdb_server', pouchdb_server);
// ...
app.listen(3000);
```



## Testing

If you're interested in running the test suites, `grunt server test:pouchdb` or
`grunt server test:couchdb`. You can specify specific test files to run for
the couchdb test suite with `grunt server test:couchdb:basics`. 

Make sure that you have halted your CouchDB server so that the two are not
competing for the same port.

