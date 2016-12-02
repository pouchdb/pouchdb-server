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
npm install

cd ../..

./bin/pouchdb-server -n -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd node_modules/pouchdb/

COUCH_HOST=http://localhost:6984 TIMEOUT=120000 npm run test-node

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
