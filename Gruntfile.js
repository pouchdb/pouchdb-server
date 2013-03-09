
var spawn = require('child_process').spawn;

module.exports = function(grunt) {

  grunt.initConfig({

    test: {
      pouchdb: {
        cmd: 'grunt',
        args: ['cors-server', 'node-qunit'],
        root: './node_modules/pouchdb'
      },
      couchdb: {
        cmd: 'npm',
        args: ['start'],
        root: './node_modules/couchdb-harness'
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
