#!/bin/bash

cd node_modules/pouchdb/
npm install

# TODO: dirty, figure out why npm link doesn't work
rm -fr node_modules/pouchdb-server
ln -s ../../.. node_modules/pouchdb-server

SERVER=pouchdb-server npm test
