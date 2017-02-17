#!/bin/bash

DIRECTORY='pouchdb-tests'
echo "running"
echo $DIRECTORY

if [ ! -d "$DIRECTORY" ]; then
  echo "cloning"
  # Control will enter here if $DIRECTORY exists.
  git clone --single-branch --branch master \
    https://github.com/pouchdb/pouchdb.git ${DIRECTORY}
fi

cd pouchdb-tests
npm install
echo "done"
ls -a

cd ..
