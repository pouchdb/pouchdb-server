#!/bin/bash

./bin/pouchdb-server -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd node_modules/pouchdb/
npm install

COUCH_HOST=http://localhost:6984 npm test

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
