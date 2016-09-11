#!/bin/bash

# install pouchdb from git master rather than npm,
# so we can run its own tests
rm -fr node_modules/pouchdb
git clone --single-branch --branch master \
  https://github.com/pouchdb/pouchdb.git node_modules/pouchdb

cd node_modules/pouchdb/
git reset --hard c3b79b9
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
