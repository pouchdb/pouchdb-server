# Contributing

## Getting started

Want to help me make this thing awesome? Great! Here's how you should get started.

1. First, check whether your bugfix must be in `express-pouchdb` or `pouchdb-server`.
2. Make your changes on a separate branch whose name reflects your changes,
3. Run all tests to make sure your changes do not break anything
4. To create a PR, push your changes to your fork, and open a pull request!
5. For a PR, follow the commit message style guidelines in[PouchDB CONTRIBUTING.md](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md).

## Release process

`pouchdb-server` is a monorepo, meaning that when you publish, you need to publish all packages simultaneously. Versions are kept in sync for simplicity's sake.

Release process:

1. `npm version patch | minor | major` to change the version in the top-level `package.json`, which will apply to all packages in the release script
2. `git push origin master --tags`
3. `npm run release`