/*
	Copyright 2013-2014, Marten de Vries

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

"use strict";

exports.evaluate = function (requireContext, extraVars, program) {
  /*jshint evil:true, unused: false */
  var require;
  if (requireContext) {
    require = function (libPath) {
      var module = {
        id: libPath,
        //no way to fill in current and parent that I know of
        current: undefined,
        parent: undefined,
        exports: {}
      };
      var exports = module.exports;

      var path = libPath.split("/");
      var lib = requireContext;
      for (var i = 0; i < path.length; i += 1) {
        lib = lib[path[i]];
      }
      eval(lib);
      return module.exports;
    };
  }
  var isArray = Array.isArray;
  var toJSON = JSON.stringify;
  var log = console.log.bind(console);
  var sum = function (array) {
    return array.reduce(function (a, b) {
      return a + b;
    });
  };

  var statements = "";
  for (var name in extraVars) {
    if (extraVars.hasOwnProperty(name)) {
      statements += "var " + name + " = extraVars['" + name + "'];\n";
    }
  }

  var func;
  try {
    func = eval(statements + "(" + program + ");");
    if (typeof func !== "function") {
      //activate the exception handling mechanism down here.
      throw "no function";
    }
  } catch (e) {
    throw {
      "error": "compilation_error",
      "status": 500,
      "reason": "Expression does not eval to a function. " + program
    };
  }
  return func;
};

exports.wrapExecutionError = function (e) {
  return {
    error: e.name,
    reason: e.toString() + "\n\n" + e.stack,
    status: 500
  };
};
