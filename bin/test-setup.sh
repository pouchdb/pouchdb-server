#!/bin/bash

POUCHDB_SHA=c93fe274492fb660ea5228d68577cc9e77fe4337
DIRECTORY='pouchdb-tests'

if [ ! -d "$DIRECTORY" ]; then
  # Control will enter here if $DIRECTORY exists.
  git clone --single-branch --branch master \
    https://github.com/pouchdb/pouchdb.git ${DIRECTORY}
fi

cd pouchdb-tests
git reset --hard ${POUCHDB_SHA}
npm install

cd ..
