"use strict";

/*global describe, it, after, before */

var fs = require("fs");
var chai = require('chai');
var should = chai.should();
var PouchDB = require('pouchdb');
var memdown = require('memdown');
//pouchdb-size
PouchDB.plugin(require('../'));

describe('pouchdb-size tests', function () {
  before(function (done) {
    fs.mkdir("b", done);
  });
  after(function (done) {
    PouchDB.destroy("a").then(function () {
      return PouchDB.destroy('b/chello world!');
    }).then(function () {
      fs.rmdir("b", done);
    });
  });

  it("should work in the normal case", function (done) {
    var db1 = new PouchDB('a');
    db1.installSizeWrapper();
    var promise = db1.info(function (err, info) {
      should.not.exist(err);

      info.disk_size.should.be.greaterThan(0);
      done();
    });
    promise.should.have.property("then");
  });

  it("should work with a weird name and a prefix", function (done) {
    var db2 = new PouchDB('hello world!', {prefix: "b/c"});
    db2.installSizeWrapper();
    db2.info(function (err, info) {
      should.not.exist(err);

      info.disk_size.should.be.greaterThan(0);
      done();
    });
  });

  it("shouldn't disrupt a non-leveldb leveldown adapter", function (done) {
    var db3 = new PouchDB('d', {db: memdown});
    db3.installSizeWrapper();
    db3.info(function (err, info) {
      should.not.exist(err);
      should.not.exist(info.disk_size);
      info.db_name.should.equal("d");

      var promise = db3.getDiskSize(function (err, size) {
        //getDiskSize() should provide a more solid error.
        err.should.exist();
        should.not.exist(size);

        done();
      });
      promise.should.have.property("then");
    });
  });

  it("shouldn't disrupt non-leveldown adapter", function (done) {
    //mock object
    var db4 = {
      type: function () {
        return "http";
      }
    };
    PouchDB.prototype.getDiskSize.call(db4, function (err, size) {
      err.should.exist();
      should.not.exist(size);

      done();
    });
  });
});
