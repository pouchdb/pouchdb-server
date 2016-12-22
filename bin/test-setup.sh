#!/bin/bash

# install pouchdb from git rather than npm,
# so we can run its own tests
# also this branch may change as we update pouchdb
# versions because we can't necessarily test against
# the master tests since we use the version of pouchdb
# from npm
rm -rf pouchdb
git clone --single-branch \
  --branch master \
  --depth 300 \
  https://github.com/pouchdb/pouchdb.git pouchdb
cd pouchdb
# using a specific commit for now rather than master
git reset --hard 587ba8f4df4b6fcf32a8fd015f8c7ebadd8f280d
npm install
cd -

npm link
cd node_modules/pouchdb-server
npm link express-pouchdb
cd -
