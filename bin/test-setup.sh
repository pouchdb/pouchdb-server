#!/bin/bash

DIRECTORY='pouchdb-tests'

if [ ! -d "$DIRECTORY" ]; then
  # Control will enter here if $DIRECTORY exists.
  git clone --single-branch --branch master \
    https://github.com/pouchdb/pouchdb.git ${DIRECTORY}
fi

cd pouchdb-tests
npm install

cd ..
