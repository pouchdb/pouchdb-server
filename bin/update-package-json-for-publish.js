'use strict';

// Update all the dependencies inside packages/node_modules/*/package.json
// to reflect the true dependencies (automatically determined by require())
// and update the version numbers to reflect the version from the top-level
// dependencies list.

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var findRequires = require('find-requires');
var builtinModules = require('builtin-modules');
var uniq = require('lodash.uniq');
var flatten = require('lodash.flatten');

var topPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var modules = fs.readdirSync('./packages/node_modules');

modules.forEach(function (mod) {
  var pkgDir = path.join('./packages/node_modules', mod);
  var pkgPath = path.join(pkgDir, 'package.json');
  var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // for the dependencies, find all require() calls
  var srcFiles = glob.sync(path.join(pkgDir, 'src/**/*.js'));
  var uniqDeps = uniq(flatten(srcFiles.map(function (srcFile) {
    var code = fs.readFileSync(srcFile, 'utf8');
    try {
      return findRequires(code);
    } catch (e) {
      return []; // happens if this is an es6 module, parsing fails
    }
  }))).filter(function (dep) {
    // some modules require() themselves, e.g. for plugins
    return dep !== pkg.name &&
      // exclude built-ins like 'inherits', 'fs', etc.
      builtinModules.indexOf(dep) === -1;
  }).sort();

  //find dependencies and igonore if we referencing a local file
  const dependencies = uniqDeps.reduce((deps, dep) => {
    if (/^\.\//.test(dep)) {
      return deps; // do nothing its a local file
    }

    dep = dep.split('/')[0]; // split colors/safe to be colors

    if (topPkg.dependencies[dep]) {
      deps.dependencies[dep] = topPkg.dependencies[dep];
    } else if (topPkg.optionalDependencies[dep]) {
      deps.optionalDependencies[dep] = topPkg.optionalDependencies[dep];
    } else if (modules.indexOf(dep) !== -1) { // core pouchdb-* module
      deps.dependencies[dep] = topPkg.version;
    } else {
      throw new Error('Unknown dependency ' + dep);
    }

    return deps;
  }, {
    dependencies: {},
    optionalDependencies: {}
  });

  Object.assign(pkg, dependencies);

  var jsonString = JSON.stringify(pkg, null, '  ') + '\n';
  fs.writeFileSync(pkgPath, jsonString, 'utf8');
});
