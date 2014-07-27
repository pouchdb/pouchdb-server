#!/bin/bash

node bin/pouchdb-server -p 6984 &
export POUCHDB_SERVER_PID=$!
./node_modules/couchdb-harness/bin/couchdb-harness -p 6984

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
