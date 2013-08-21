
/**
 * Module dependencies.
 */

var express = require('express')
  , path = require('path');

var app = express();

app.configure(function(){
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/db', require('../../'));
});

app.listen(3000);
console.log("Express server listening on port " + 3000);
