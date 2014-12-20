"use strict";

var XHR = global.XMLHttpRequest;

/* istanbul ignore else */
if (typeof XHR === "undefined") {
  XHR = require('xhr2');
}
var Promise = require('pouchdb-promise');
var extend = require('extend');
var wrappers = require('pouchdb-wrappers');

module.exports = function (PouchDB, url, opts) {
  var api = {};

  api.allDbs = function () {
    return new Promise(function (resolve, reject) {
      var xhr = new XHR();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          resolve(JSON.parse(xhr.responseText));
        }
      };
      xhr.open('GET', url + '_all_dbs');
      xhr.send();
    });
  };

  api.destroy = function (orig, args) {
    args.options.name = getName(args.options.name);

    return orig();
  };

  function getName(name) {
    if (!/https?:/.test(name)) {
      name = url + name;
    }
    return name;
  }

  var getHost = new PouchDB('test', {adapter: 'http'}).getHost;
  var HTTPPouchDB = PouchDB.defaults({
    adapter: 'http',
    getHost: function (name, specificOpts) {
      return getHost(getName(name), extend({}, opts, specificOpts));
    }
  });
  wrappers.installStaticWrapperMethods(HTTPPouchDB, api);
  HTTPPouchDB.isHTTPPouchDB = true;
  return HTTPPouchDB;
};
