
var spawn = require('child_process').spawn;

module.exports = function(grunt) {

  grunt.initConfig({

    test: {
      pouchdb: {
        cmd: 'grunt',
        root: './node_modules/pouchdb',
        args: ['cors-server', 'node-qunit']
      },
      couchdb: {
        cmd: './bin/couchdb-harness',
        root: './node_modules/couchdb-harness',
        args: []
      }
    }

  });

  grunt.registerMultiTask('test', function () {
    var task = spawn(this.data.cmd, this.data.args, { cwd: this.data.root })
      , done = this.async();

    task.stdout.on('data', function (data) {
      grunt.log.write(data.toString());
    });

    task.stderr.on('data', function (data) {
      grunt.log.write(data.toString());
    });

    task.on('exit', function (code) {
      done(!code);
    });
  });

  grunt.registerTask('default', ['test']);

};
