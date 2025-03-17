var should = require('chai').should();
var PouchDB = require('pouchdb');
var memdown = require('memory-level');
var fse = require("fs-extra");

PouchDB.plugin(require('pouchdb-size'));

describe('pouchdb-size tests', function () {
  before(function () {
    return fse.mkdir("b");
  });

  after(function () {
    return new PouchDB("a").destroy().then(function () {
      return new PouchDB('b/chello world!').destroy();
    }).then(function () {
      return fse.rmdir("b");
    }).then(function () {
      return fse.remove("g");
    }).then(function () {
      return fse.remove("h");
    });
  });

  it("should work in the normal case", function () {
    var db = new PouchDB('a');
    db.installSizeWrapper();
    var promise = db.info()
      .then(function (info) {
        info.disk_size.should.be.greaterThan(0);
      });
    promise.should.have.property("then");
    return promise;
  });

  it("should work with a weird name and a prefix", function () {
    var db = new PouchDB('hello world!', {prefix: "b/c"});
    db.installSizeWrapper();
    return db.info()
      .then(function (info) {
        info.disk_size.should.be.greaterThan(0);
      });
  });

  it("shouldn't disrupt a non-leveldb leveldown adapter", function () {
    var db = new PouchDB('d', {db: memdown});
    db.installSizeWrapper();
    var promise = db.info()
      .then(function (info) {
        should.not.exist(info.disk_size);
        info.db_name.should.equal("d");

        return db.getDiskSize()
          .then(function (size) {
            should.not.exist(size);
          })
          .catch(function (err) {
            //getDiskSize() should provide a more solid error.
            err.should.exist;
          });
      });
    promise.should.have.property("then");
    return promise;
  });

  it("shouldn't disrupt non-leveldown adapter", function (done) {
    //mock object
    var db = {
      type: function () {
        return "http";
      }
    };
    PouchDB.prototype.getDiskSize.call(db, function (err, size) {
      err.should.exist;
      should.not.exist(size);
      done();
    });
  });

});
