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
  --depth 1 \
  https://github.com/pouchdb/pouchdb.git pouchdb
cd pouchdb
npm install
cd -
