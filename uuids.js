var Pouch = require('pouchdb');
var head = Pouch.utils.uuid();

// increment the head uuid, e.g. '91CBDD95-7616-2EA6-846A-245287BFDCB7'
// TODO: rollover is possible but highly unlikely
function increment(str) {
  var i = str.length - 1;
  var char = str[i];
  while (char === 'F' || char === '-') {
    char = str[--i];
  }
  // A -> B, 1 -> 2, etc.
  var newChar = (1 + parseInt(char, 16)).toString(16).toUpperCase();
  var ret = str.substring(0, i) + newChar;
  while (++i < str.length) {
    ret += str[i] === '-' ? '-' : '0';
  }
  return ret;
}

// show the first n without modifying the queue
exports.getFirst = function (limit) {
  var output = [];
  var current = head;
  while (limit > output.length) {
    output.push(current);
    current = increment(current);
  }
  return output;
};

// return and remove the first element from the queue
exports.dequeue = function () {
  var ret = head;
  head = increment(head);
  return ret;
}