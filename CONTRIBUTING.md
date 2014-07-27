Want to help me make this thing awesome? Great! Here's how you should get started.

1. First, make sure that the bugfix or feature you're looking to implement isn't better fit for [express-pouchdb](https://github.com/nick-thompson/express-pouchdb).
2. PouchDB is still developing rapidly. If you need bleeding egde versions, you should first read how to [set up express-pouchdb for local development](https://github.com/nick-thompson/express-pouchdb#contributing). (Make sure that, afterwards, you `npm link` express-pouchdb).
3. Go ahead and fork **pouchdb-server**, clone it to your machine.
4. Now you'll want to, from the root of **pouchdb-server**, `npm link express-pouchdb`.
5. `npm install` the rest of the dependencies.

Please make your changes on a separate branch whose name reflects your changes, push them to your fork, and open a pull request!

For commit message style guidelines, please refer to [PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).
