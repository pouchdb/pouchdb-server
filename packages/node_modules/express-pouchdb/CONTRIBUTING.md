# Contributing

Want to help me make this thing awesome? Great! Here's how you should get started.

1. Because PouchDB is still developing so rapidly, you'll want to clone `git@github.com:pouchdb/pouchdb.git`, and run `npm link` from the root folder of your clone.
2. Fork **express-pouchdb**, and clone it to your local machine.
3. From the root folder of your clone run `npm link pouchdb` to install PouchDB from your local repository from Step 1.
4. `npm install`

Please make your changes on a separate branch whose name reflects your changes, push them to your fork, and open a pull request!

For commit message style guidelines, please refer to [PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

## Fauxton

The custom Fauxton theme, with the PouchDB Server name and logo, are kept [in a Fauxton fork](https://github.com/nolanlawson/couchdb-fauxton) for the time being.

## Testing

To test for regressions, the following comes in handy:
- the PouchDB test suite: ``npm run test-pouchdb``
- the jshint command: ``npm run jshint``
- the express-pouchdb test suite (for express-pouchdb specific things like its API only!): ``npm run test-express-pouchdb``

``npm test`` combines these three.

There is also the possibility to run express-pouchdb against a part of
the CouchDB test suite. For that, try: ``npm run test-couchdb``. If it
doesn't work, try using [couchdb-harness](https://github.com/nick-thompson/couchdb-harness),
which that command is based on, directly.
