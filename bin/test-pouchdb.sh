#!/bin/bash

# install pouchdb from git master rather than npm,
# so we can run its own tests
rm -fr node_modules/pouchdbclone
git clone --depth 1 --single-branch --branch master \
  https://github.com/pouchdb/pouchdb.git node_modules/pouchdbclone

cd node_modules/pouchdbclone/
npm install
npm build
cd ../..
rm -fr node_modules/pouchdb
ln -s ./pouchdbclone/packages/pouchdb ./node_modules/pouchdb
cd node_modules/pouchdb
npm install

cd ../..

./bin/pouchdb-server -n -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd node_modules/pouchdbclone/

COUCH_HOST=http://localhost:6984 TIMEOUT=120000 npm run test-node

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
