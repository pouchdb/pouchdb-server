#!/bin/bash

# install pouchdb from git rather than npm,
# so we can run its own tests
# also this branch may change as we update pouchdb
# versions because we can't necessarily test against
# the master tests since we use the version of pouchdb
# from npm
rm -fr node_modules/pouchdb
git clone --single-branch \
  --branch for-express-pouchdb-testing-DONT-DELETE \
  --depth 1 \
  https://github.com/pouchdb/pouchdb.git node_modules/pouchdb

cd node_modules/pouchdb/
# checkout pouchdb 6.0.7 commit for now
npm install
cd node_modules/pouchdb-server/node_modules
rm -fr express-pouchdb
ln -s ../../../../.. express-pouchdb
cd ../../../../..

# link pouchdb-server back to us
cd node_modules/pouchdb-server
npm install
cd node_modules
rm -fr express-pouchdb
ln -s ../../.. express-pouchdb
# link pouchdb-server's pouchdb to the master/master one
rm -fr pouchdb
ln -s ../../pouchdb pouchdb
cd ../../..
