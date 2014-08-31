/*
    Copyright 2014, Marten de Vries

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

var Promise = require("pouchdb-promise");
var nodify = require("promise-nodify");

exports.installWrapperMethods = function (db, handlers) {
  for (var name in handlers) {
    if (!handlers.hasOwnProperty(name)) {
      continue;
    }
    var info = getBaseAndName(db, name);
    var original = info.base[info.name];
    if (!original) {
      //no method to wrap
      continue;
    }
    if (original.hasOwnProperty("_handlers")) {
      if (original._handlers.indexOf(handlers[name]) !== -1) {
        throw new Error("Wrapper method for '" + name + "' already installed: " + handlers[name]);
      }
      original._handlers.push(handlers[name]);
    } else {
      info.base[info.name] = exports.createWrapperMethod(name, original, handlers[name], db);
    }
  }
};

function getBaseAndName(base, name) {
  name = name.split(".");
  while (name.length > 1) {
    base = base[name.shift(0)];
  }
  return {
    base: base,
    name: name[0]
  };
}

exports.createWrapperMethod = function (name, original, handler, db) {
  var createWrapper = wrapperCreators[name];
  if (typeof createWrapper === "undefined") {
    throw new Error("No known wrapper for method name: " + name); //coverage: ignore
  }
  var handlers = [handler];
  var wrapper = createWrapper(db, original, handlers);
  wrapper._original = original;
  wrapper._handlers = handlers;
  return wrapper;
};

var wrapperCreators = {};

wrapperCreators.destroy = function (db, destroy, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(destroy, args));
  };
};

wrapperCreators.put = function (db, put, handlers) {
  return function (doc, docId, docRev, options, callback) {
    var args = {};
    args.db = db || this;
    var argsList = Array.prototype.slice.call(arguments);
    //parsing code borrowed from PouchDB (adapted).
    args.doc = argsList.shift();
    var id = '_id' in args.doc;
    while (true) {
      var temp = argsList.shift();
      var temptype = typeof temp;
      if (temptype === "string" && !id) {
        args.doc._id = temp;
        id = true;
      } else if (temptype === "string" && id && !('_rev' in args.doc)) {
        args.doc._rev = temp;
      } else if (temptype === "object") {
        args.options = temp;
      } else if (temptype === "function") {
        args.callback = temp;
      }
      if (!argsList.length) {
        break;
      }
    }
    args.options = args.options || {};
    return callHandlers(handlers, args, function () {
      return put.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.post = function (db, post, handlers) {
  return function (doc, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    args.doc = doc;
    return callHandlers(handlers, args, function () {
      return post.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.get = function (db, get, handlers) {
  return function(docId, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    args.docId = docId;
    return callHandlers(handlers, args, function () {
      return get.call(this, args.docId, args.options);
    });
  };
};

wrapperCreators.remove = function (db, remove, handlers) {
  return function (docOrId, optsOrRev, opts, callback) {
    var args;

    //originally borrowed from PouchDB
    if (typeof optsOrRev === 'string') {
      // id, rev, opts, callback style
      args = parseBaseArgs(db || this, opts, callback);
      args.doc = {
        _id: docOrId,
        _rev: optsOrRev
      };
    } else {
      // doc, opts, callback style
      args = parseBaseArgs(db || this, optsOrRev, opts);
      args.doc = docOrId;
    }

    return callHandlers(handlers, args, function () {
      return remove.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.bulkDocs = function (db, bulkDocs, handlers) {
  return function (docs, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    //support the deprecated signature.
    args.docs = docs.docs || docs;
    return callHandlers(handlers, args, function () {
      return bulkDocs.call(this, args.docs, args.options);
    });
  };
};

wrapperCreators.allDocs = function (db, allDocs, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(allDocs, args));
  };
};

wrapperCreators.changes = function (db, changes, handlers) {
  return function (options, callback) {
    //the callback argument is no longer documented. (And deprecated?)
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(changes, args));
  };
};

wrapperCreators.sync = function (db, replicate, handlers) {
  return function (url, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    args.url = url;
    return callHandlers(handlers, args, function () {
      return replicate.call(this, args.url, args.options);
    });
  };
};

wrapperCreators["replicate.from"] = wrapperCreators.sync;
wrapperCreators["replicate.to"] = wrapperCreators.sync;

wrapperCreators.putAttachment = function (db, putAttachment, handlers) {
  return function (docId, attachmentId, rev, doc, type, options, callback) {
    //options is not an 'official' argument. But some plug-ins need it
    //and maybe (?) also the http adapter.
    var args = parseBaseArgs(db || this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    args.rev = rev;
    args.doc = doc;
    args.type = type;
    return callHandlers(handlers, args, function () {
      return putAttachment.call(this, args.docId, args.attachmentId, args.rev, args.doc, args.type);
    });
  };
};

wrapperCreators.getAttachment = function (db, getAttachment, handlers) {
  return function (docId, attachmentId, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    return callHandlers(handlers, args, function () {
      return getAttachment.call(this, args.docId, args.attachmentId, args.options);
    });
  };
};

wrapperCreators.removeAttachment = function (db, removeAttachment, handlers) {
  return function (docId, attachmentId, rev, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db || this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    args.rev = rev;
    return callHandlers(handlers, args, function () {
      return removeAttachment.call(this, args.docId, args.attachmentId, args.rev);
    });
  };
};

wrapperCreators.query = function (db, query, handlers) {
  return function (fun, options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    args.fun = fun;
    return callHandlers(handlers, args, function () {
      return query.call(this, args.fun, args.options);
    });
  };
};

wrapperCreators.viewCleanup = function (db, viewCleanup, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(viewCleanup, args));
  };
};

wrapperCreators.info = function (db, info, handlers) {
  return function (options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, info);
  };
};

wrapperCreators.compact = function (db, compact, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(compact, args));
  };
};

wrapperCreators.revsDiff = function (db, revsDiff, handlers) {
  return function (diff, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db || this, options, callback);
    args.diff = diff;
    return callHandlers(handlers, args, function () {
      return revsDiff.call(this, args.diff);
    });
  };
};

//Plug-in wrapperCreators; only of the plug-ins for which a wrapper
//has been necessary.

wrapperCreators.getSecurity = function (db, getSecurity, handlers) {
  return function (options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db || this, options, callback);
    return callHandlers(handlers, args, getSecurity);
  };
};

wrapperCreators.putSecurity = function (db, putSecurity, handlers) {
  return function (secObj, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db || this, options, callback);
    args.secObj = secObj;
    return callHandlers(handlers, args, function () {
      return putSecurity.call(this, args.secObj);
    });
  };
};

function parseBaseArgs(db, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return {
    db: db,
    options: options || {},
    callback: callback
  };
}

function callHandlers(handlers, args, method) {
  var callback = args.callback;
  delete args.callback;

  //build a chain of handlers: the bottom handler calls the 'real'
  //method, the other handlers call other handlers.
  method = method.bind(args.db);
  for (var i = handlers.length - 1; i >= 0; i -= 1) {
    method = handlers[i].bind(null, method, args);
  }
  //start running the chain. Not just using Promise.resolve() because
  //some methods (e.g. .changes()) return ones that aren't just
  //promises.
  var promise;
  try {
    promise = method();
  } catch (err) {
    promise = Promise.reject(err);
  }
  if (!promise.then) {
    promise = Promise.resolve(promise);
  }
  nodify(promise, callback);
  return promise;
}

function makeCallWithOptions(func, args) {
  return function () {
    return func.call(this, args.options);
  };
}

exports.uninstallWrapperMethods = function (db, handlers) {
  for (var name in handlers) {
    if (!handlers.hasOwnProperty(name)) {
      continue;
    }
    var info = getBaseAndName(db, name);
    var wrapper = info.base[info.name];

    var idx;
    try {
      idx = wrapper._handlers.indexOf(handlers[name]);
    } catch (err) {
      idx = -1;
    }
    if (idx === -1) {
      throw new Error("Wrapper method for '" + name + "' not installed: " + handlers[name]);
    }
    wrapper._handlers.splice(idx, 1);
    if (!wrapper._handlers.length) {
      //fall back to the original on the prototype.
      delete info.base[info.name];
      if (info.base[info.name] !== wrapper._original) {
        //nothing or something unexpected was on the prototype. (E.g.
        //replicate.to). Reset the original manually.
        info.base[info.name] = wrapper._original;
      }
    }
  }
};
