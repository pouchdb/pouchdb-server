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
    if (db[name].hasOwnProperty("_handlers")) {
      if (db[name]._handlers.indexOf(handlers[name]) !== -1) {
        throw new Error("Wrapper method for '" + name + "' already installed: " + handlers[name]);
      }
      db[name]._handlers.push(handlers[name]);
    } else {
      db[name] = exports.createWrapperMethod(name, db[name], handlers[name]);
    }
  }
};

exports.uninstallWrapperMethods = function (db, handlers) {
  for (var name in handlers) {
    if (!handlers.hasOwnProperty(name)) {
      continue;
    }
    var idx;
    try {
      idx = db[name]._handlers.indexOf(handlers[name]);
    } catch (err) {
      idx = -1;
    }
    if (idx === -1) {
      throw new Error("Wrapper method for '" + name + "' not installed: " + handlers[name]);
    }
    db[name]._handlers.splice(idx, 1);
    if (!db[name]._handlers.length) {
      //fall back to the original on the prototype.
      delete db[name];
    }
  }
};

exports.createWrapperMethod = function (name, base, handler) {
  var createWrapper = wrapperCreators[name];
  var handlers = [handler];
  var wrapper = createWrapper(base, handlers);
  wrapper._handlers = handlers;
  return wrapper;
};

var wrapperCreators = {};

wrapperCreators.destroy = function (destroy, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(this, options, callback);
    return callHandlers(handlers, args, callWithOptions(destroy, args));
  };
};

wrapperCreators.put = function (put, handlers) {
  return function (doc, docId, docRev, options, callback) {
    var args = {};
    args.db = this;
    var argsList = Array.prototype.slice.call(arguments);
    //parsing code borrowed from PouchDB (adapted).
    args.doc = argsList.shift();
    var id = '_id' in doc;
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
      if (!args.length) {
        break;
      }
    }
    args.options = args.options || {};
    return callHandlers(handlers, args, function () {
      return put.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.post = function (post, handlers) {
  return function (doc, options, callback) {
    var args = parseBaseArgs(this, options, callback);
    args.doc = doc;
    return callHandlers(handlers, args, function () {
      return post.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.get = function (get, handlers) {
  return function(docId, options, callback) {
    var args = parseBaseArgs(this, options, callback);
    args.docId = docId;
    return callHandlers(handlers, args, function () {
      return get.call(this, args.docId, args.options);
    });
  };
};

wrapperCreators.remove = function (remove, handlers) {
  return function (docOrId, optsOrRev, opts, callback) {
    var args;

    //originally borrowed from PouchDB
    if (typeof optsOrRev === 'string') {
      // id, rev, opts, callback style
      args = parseBaseArgs(this, opts, callback);
      args.doc = {
        _id: docOrId,
        _rev: optsOrRev
      };
    } else {
      // doc, opts, callback style
      args = parseBaseArgs(this, optsOrRev, opts);
      args.doc = docOrId;
    }

    return callHandlers(handlers, args, function () {
      return remove.call(this, args.doc, args.options);
    });
  };
};

wrapperCreators.bulkDocs = function (bulkDocs, handlers) {
  return function (docs, options, callback) {
    var args = parseBaseArgs(this, options, callback);
    //support the deprecated signature.
    args.docs = docs.docs || docs;
    return callHandlers(handlers, args, function () {
      return bulkDocs.call(this, args.docs, args.options);
    });
  };
};

wrapperCreators.allDocs = function (allDocs, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(this, options, callback);
    return callHandlers(handlers, args, callWithOptions(allDocs, args));
  };
};

wrapperCreators.changes = function () {}; //TODO

wrapperCreators.replicate = function () {}; //TODO

wrapperCreators.replicate_to = function () {}; //TODO

wrapperCreators.replicate_from = function () {}; //TODO

wrapperCreators.sync = function () {}; //TODO

wrapperCreators.putAttachment = function (putAttachment, handlers) {
  return function (docId, attachmentId, rev, doc, type, options, callback) {
    //options is not an 'official' argument. But some plug-ins need it
    //and maybe (?) also the http adapter.
    var args = parseBaseArgs(this, options, callback);
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

wrapperCreators.getAttachment = function (getAttachment, handlers) {
  return function (docId, attachmentId, options, callback) {
    var args = parseBaseArgs(this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    return callHandlers(handlers, args, function () {
      return getAttachment.call(this, args.docId, args.attachmentId, args.options);
    });
  };
};

wrapperCreators.removeAttachment = function (removeAttachment, handlers) {
  return function (docId, attachmentId, rev, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    args.rev = rev;
    return callHandlers(handlers, args, function () {
      return removeAttachment.call(this, args.docId, args.attachmentId, args.rev);
    });
  };
};

wrapperCreators.query = function (query, handlers) {
  return function (fun, options, callback) {
    var args = parseBaseArgs(this, options, callback);
    args.fun = fun;
    return callHandlers(handlers, args, function () {
      return query.call(this, args.fun, args.options);
    });
  };
};

wrapperCreators.viewCleanup = function (viewCleanup, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(this, options, callback);
    return callHandlers(handlers, args, callWithOptions(viewCleanup, args));
  };
};

wrapperCreators.info = function (info, handlers) {
  return function (options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(this, options, callback);
    return callHandlers(handlers, args, info);
  };
};

wrapperCreators.compact = function (compact, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(this, options, callback);
    return callHandlers(handlers, args, callWithOptions(compact, args));
  };
};

wrapperCreators.revsDiff = function (revsDiff, handlers) {
  return function (diff, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(this, options, callback);
    args.diff = diff;
    return callHandlers(handlers, args, function () {
      return revsDiff.call(this, args.diff);
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
  //start running the chain
  var promise = Promise.resolve().then(method);
  nodify(promise, callback);
  return promise;
}

function callWithOptions(func, args) {
  /*jshint validthis: true */
  return func.call(this, args.options);
}
