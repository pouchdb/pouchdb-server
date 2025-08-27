"use strict";

var uuid = require('uuid');

module.exports = function generate(limit) {
  var output = [];
  var i = -1;
  while (++i < limit) {
    output.push(uuid.v4());
  }
  return output;
};
