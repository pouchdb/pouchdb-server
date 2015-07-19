#!/bin/bash

# link pouchdb back to us
cd node_modules/pouchdb
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
