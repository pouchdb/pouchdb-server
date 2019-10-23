#!/bin/bash

# Check out PouchDB itself from master and build it, so that we can
# run its test suite.
# Note: this will start to fail randomly if something changes in
# PouchDB master. In those cases, just pin it to a specific Git commit.

DIRECTORY='pouchdb-tests'

if [ ! -d "$DIRECTORY" ]; then
  # Control will enter here if $DIRECTORY exists.
  git clone --single-branch --branch 7.0.0 \
    --depth 500 \
    https://github.com/pouchdb/pouchdb.git ${DIRECTORY}
fi

cd "$DIRECTORY"
npm install
cd ..
