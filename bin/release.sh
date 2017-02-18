#!/usr/bin/env bash

for pkg in $(ls packages/node_modules); do
  if [ ! -d "packages/node_modules/$pkg" ]; then
    continue
  elif [ "true" = $(node --eval "console.log(require('./packages/node_modules/$pkg/package.json').private);") ]; then
    continue
  fi
  cd packages/node_modules/$pkg
  echo "Publishing $pkg..."
  npm publish
  cd -
done

git checkout -- packages/node_modules/*/package.json