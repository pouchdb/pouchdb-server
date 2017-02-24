'use strict';

var Pouch = require('pouchdb')
var memwatch = require('memwatch-next')
var dbs = []
var promises = Promise.resolve()

function next() {
  return new Promise(resolve => setTimeout(resolve, 1)).then(() => {
    dbs.push(new Pouch('/tmp/tmp.db'))
  })
}

for (var i = 0; i < 100000; i++) {
  promises = promises.then(next)
}
memwatch.on('leak', leak => console.log(leak))
memwatch.on('stats', leak => console.log(leak))
