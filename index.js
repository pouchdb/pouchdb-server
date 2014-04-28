"use strict";

var Promise = require("lie");
var buildRequestObject = require("../builders/couchrequestobject.js");
var render = require("../utils/couchrender.js");
var addCallback = require("../utils/promisewrapper.js");

exports.show = function (showPath, options, callback) {
  //options:
  //- reqObjStub
  //- format
  "use strict";

  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  var db = this;

  var splitted = showPath.split("/");
  var designDocName = splitted[0];
  var showName = splitted[1];
  var docId = splitted[2];
  if (docId === "_design" && splitted.length > 3) {
    docId += "/" + splitted[3];
  }

  //build request object
  var infoPromise = db.info();
  var pathPromise = infoPromise.then(function (info) {
    var path = [info.db_name, "_design", designDocName, "_show", showName];
    if (docId) {
      path.push.apply(path, docId.split("/"));
    }
    return path;
  });
  var reqPromise = buildRequestObject(options, pathPromise, infoPromise, db);

  //get the documents involved.
  var ddocPromise = db.get("_design/" + designDocName).then(function (designDoc) {
    if (!(designDoc.shows || {}).hasOwnProperty(showName)) {
      throw {
        status: 404,
        error: "not_found",
        reason: "missing show function " + showName + " on design doc _design/" + designDocName
      };
    }
    return designDoc;
  });
  var docPromise = db.get(docId).catch(function () {
      //doc might not exist - that's ok and expected.
      return null;
  });
  var promise = Promise.all([ddocPromise, docPromise, reqPromise]).then(function (args) {
    //all data collected - do the magic that is a show function
    var designDoc = args[0];
    var doc = args[1];
    var req = args[2];

    var source = designDoc.shows[showName];

    return render(source, designDoc, doc, req);
  });
  addCallback(promise, callback);
  return promise;
};
