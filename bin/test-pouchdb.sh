#!/bin/bash

cd node_modules/pouchdb/
npm install

SERVER=pouchdb-server npm test
