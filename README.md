# PouchDB-Server monorepo

[![Build Status](https://travis-ci.org/pouchdb/pouchdb-server.svg)](https://travis-ci.org/pouchdb/pouchdb-server)

This is the monorepo for the majority of packages that are used by PouchDB-Server and Express-PouchDB.

## Building

  1. Run `npm install` and then `npm run build` to build all dependancies

## Contributing

Want to help me make this thing awesome? Great! Here's how you should get started.
We use [Lerna](https://lernajs.io/) to manage this git repo. After you have cloned the repo do the following:

1. `npm install` to install base dependancies
2. `npm bootstrap` to install all dependancies and link all the packages in the repo.
3. First make sure the feature should be in either PouchDB-Server or Express-PouchDB
3. To run the unit tests `npm run unit-tests`
4. To fo a full test run `npm run test`

Please make your changes on a separate branch whose name reflects your changes, push them to your fork, and open a pull request!

For commit message style guidelines, please refer to [PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

## Contributors

[These people](https://github.com/pouchdb/express-pouchdb/graphs/contributors) made **pouchdb-server** into what it is today!

## License

The MIT License. See [the LICENSE file](https://github.com/pouchdb/pouchdb-server/blob/master/LICENSE) for more information.
