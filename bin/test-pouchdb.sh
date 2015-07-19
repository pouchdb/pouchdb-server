#!/bin/bash

cd node_modules/pouchdb-server

./bin/pouchdb-server -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd ../pouchdb

COUCH_HOST=http://127.0.0.1:6984 npm test

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
