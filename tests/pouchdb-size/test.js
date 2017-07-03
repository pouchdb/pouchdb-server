const chai = require('chai');
const should = chai.should();
const PouchDB = require('pouchdb');
const memdown = require('memdown');
const sqldown = require('sqldown');
const medeadown = require('medeadown');
const jsondown = require('jsondown');
const locket = require('locket');
const Promise = require('bluebird');
const fse = Promise.promisifyAll(require("fs-extra"));

const PouchDBSize = require('../../packages/node_modules/pouchdb-size');

PouchDB.plugin(PouchDBSize);

describe('pouchdb-size tests', function () {
  before(function () {
    return fse.mkdirAsync("b");
  });

  after(function () {
    return new PouchDB("a").destroy().then(function () {
      return new PouchDB('b/chello world!').destroy();
    })

    .then(function () {
      return fse.rmdirAsync("b");
    })

    .then(function () {
      return new PouchDB("e", {db: sqldown}).destroy();
    })

    .then(function () {
      return new PouchDB("./f", {db: medeadown}).destroy();
    })

    .then(function () {
      return fse.unlinkAsync("g");
    })

    .then(function () {
      return fse.removeAsync("h");
    });
  });

  it("should work in the normal case", function (done) {
    const db1 = new PouchDB('a');
    db1.installSizeWrapper();
    const promise = db1.info(function (err, info) {
      should.not.exist(err);

      info.disk_size.should.be.greaterThan(0);
      done();
    });
    promise.should.have.property("then");
  });

  it("should work with a weird name and a prefix", function (done) {
    const db2 = new PouchDB('hello world!', {prefix: "b/c"});
    db2.installSizeWrapper();
    db2.info(function (err, info) {
      should.not.exist(err);

      info.disk_size.should.be.greaterThan(0);
      done();
    });
  });

  it("shouldn't disrupt a non-leveldb leveldown adapter", function (done) {
    const db3 = new PouchDB('d', {db: memdown});
    db3.installSizeWrapper();
    db3.info(function (err, info) {
      should.not.exist(err);
      should.not.exist(info.disk_size);
      info.db_name.should.equal("d");

      const promise = db3.getDiskSize(function (err, size) {
        //getDiskSize() should provide a more solid error.
        err.should.exist;
        should.not.exist(size);

        done();
      });
      promise.should.have.property("then");
    });
  });

  it("shouldn't disrupt non-leveldown adapter", function (done) {
    //mock object
    const db4 = {
      type: function () {
        return "http";
      }
    };
    PouchDB.prototype.getDiskSize.call(db4, function (err, size) {
      err.should.exist;
      should.not.exist(size);

      done();
    });
  });

  it("should work with sqldown", function (done) {
    const db = new PouchDB("e", {db: sqldown});
    db.installSizeWrapper();

    db.getDiskSize().then(function (resp) {
      resp.should.be.greaterThan(0);

      return db.info();
    }).then(function (info) {
      info.db_name.should.equal("e");
      info.disk_size.should.be.greaterThan(0);

      done();
    });
  });

  it("should work with medeadown", function (done) {
    // ./f instead of f is needed for medeadown.
    const db = new PouchDB("./f", {db: medeadown});
    db.installSizeWrapper();

    db.info().then(function (info) {
      info.db_name.should.equal("./f");
      info.disk_size.should.be.greaterThan(0);

      done();
    });
  });

  it("should work with jsondown", function (done) {
    const db = new PouchDB("g", {db: jsondown});
    db.installSizeWrapper();

    db.info().then(function (info) {
      info.db_name.should.equal("g");
      info.disk_size.should.be.greaterThan(0);

      done();
    });
  });

  it("should work with locket", function (done) {
    const db = new PouchDB("h", {db: locket});
    db.installSizeWrapper();

    db.info().then(function (info) {
      info.db_name.should.equal("h");
      info.disk_size.should.be.greaterThan(0);

      done();
    });
  });
});
