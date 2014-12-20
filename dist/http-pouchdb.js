!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.buildHTTPPouchDB=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";

var XHR = global.XMLHttpRequest;

/* istanbul ignore else */
if (typeof XHR === "undefined") {
  XHR = require('xhr2');
}
var Promise = require('pouchdb-promise');
var extend = require('extend');
var wrappers = require('pouchdb-wrappers');

module.exports = function (PouchDB, url, opts) {
  var api = {};

  api.allDbs = function () {
    return new Promise(function (resolve, reject) {
      var xhr = new XHR();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          resolve(JSON.parse(xhr.responseText));
        }
      };
      xhr.open('GET', url + '_all_dbs');
      xhr.send();
    });
  };

  api.destroy = function (orig, args) {
    args.options.name = getName(args.options.name);

    return orig();
  };

  function getName(name) {
    if (!/https?:/.test(name)) {
      name = url + name;
    }
    return name;
  }

  var getHost = new PouchDB('test', {adapter: 'http'}).getHost;
  var HTTPPouchDB = PouchDB.defaults({
    adapter: 'http',
    getHost: function (name, specificOpts) {
      return getHost(getName(name), extend({}, opts, specificOpts));
    }
  });
  wrappers.installStaticWrapperMethods(HTTPPouchDB, api);
  HTTPPouchDB.isHTTPPouchDB = true;
  return HTTPPouchDB;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"extend":3,"pouchdb-promise":4,"pouchdb-wrappers":22,"xhr2":2}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;
var undefined;

var isPlainObject = function isPlainObject(obj) {
	'use strict';
	if (!obj || toString.call(obj) !== '[object Object]') {
		return false;
	}

	var has_own_constructor = hasOwn.call(obj, 'constructor');
	var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {}

	return key === undefined || hasOwn.call(obj, key);
};

module.exports = function extend() {
	'use strict';
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target === copy) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
					if (copyIsArray) {
						copyIsArray = false;
						clone = src && Array.isArray(src) ? src : [];
					} else {
						clone = src && isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[name] = extend(deep, clone, copy);

				// Don't bring in undefined values
				} else if (copy !== undefined) {
					target[name] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],4:[function(require,module,exports){
(function (global){
if (typeof global.Promise === 'function') {
  module.exports = global.Promise;
} else {
  module.exports = require('bluebird');
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"bluebird":8}],5:[function(require,module,exports){
'use strict';

module.exports = INTERNAL;

function INTERNAL() {}
},{}],6:[function(require,module,exports){
'use strict';
var Promise = require('./promise');
var reject = require('./reject');
var resolve = require('./resolve');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
var noArray = reject(new TypeError('must be an array'));
module.exports = function all(iterable) {
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return noArray;
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new Promise(INTERNAL);
  
  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len & !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
};
},{"./INTERNAL":5,"./handlers":7,"./promise":9,"./reject":11,"./resolve":12}],7:[function(require,module,exports){
'use strict';
var tryCatch = require('./tryCatch');
var resolveThenable = require('./resolveThenable');
var states = require('./states');

exports.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return exports.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    resolveThenable.safely(self, thenable);
  } else {
    self.state = states.FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
exports.reject = function (self, error) {
  self.state = states.REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}
},{"./resolveThenable":13,"./states":14,"./tryCatch":15}],8:[function(require,module,exports){
module.exports = exports = require('./promise');

exports.resolve = require('./resolve');
exports.reject = require('./reject');
exports.all = require('./all');
},{"./all":6,"./promise":9,"./reject":11,"./resolve":12}],9:[function(require,module,exports){
'use strict';

var unwrap = require('./unwrap');
var INTERNAL = require('./INTERNAL');
var resolveThenable = require('./resolveThenable');
var states = require('./states');
var QueueItem = require('./queueItem');

module.exports = Promise;
function Promise(resolver) {
  if (!(this instanceof Promise)) {
    return new Promise(resolver);
  }
  if (typeof resolver !== 'function') {
    throw new TypeError('reslover must be a function');
  }
  this.state = states.PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    resolveThenable.safely(this, resolver);
  }
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === states.FULFILLED ||
    typeof onRejected !== 'function' && this.state === states.REJECTED) {
    return this;
  }
  var promise = new Promise(INTERNAL);

  
  if (this.state !== states.PENDING) {
    var resolver = this.state === states.FULFILLED ? onFulfilled: onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};

},{"./INTERNAL":5,"./queueItem":10,"./resolveThenable":13,"./states":14,"./unwrap":16}],10:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var unwrap = require('./unwrap');

module.exports = QueueItem;
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};
},{"./handlers":7,"./unwrap":16}],11:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = reject;

function reject(reason) {
	var promise = new Promise(INTERNAL);
	return handlers.reject(promise, reason);
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9}],12:[function(require,module,exports){
'use strict';

var Promise = require('./promise');
var INTERNAL = require('./INTERNAL');
var handlers = require('./handlers');
module.exports = resolve;

var FALSE = handlers.resolve(new Promise(INTERNAL), false);
var NULL = handlers.resolve(new Promise(INTERNAL), null);
var UNDEFINED = handlers.resolve(new Promise(INTERNAL), void 0);
var ZERO = handlers.resolve(new Promise(INTERNAL), 0);
var EMPTYSTRING = handlers.resolve(new Promise(INTERNAL), '');

function resolve(value) {
  if (value) {
    if (value instanceof Promise) {
      return value;
    }
    return handlers.resolve(new Promise(INTERNAL), value);
  }
  var valueType = typeof value;
  switch (valueType) {
    case 'boolean':
      return FALSE;
    case 'undefined':
      return UNDEFINED;
    case 'object':
      return NULL;
    case 'number':
      return ZERO;
    case 'string':
      return EMPTYSTRING;
  }
}
},{"./INTERNAL":5,"./handlers":7,"./promise":9}],13:[function(require,module,exports){
'use strict';
var handlers = require('./handlers');
var tryCatch = require('./tryCatch');
function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }
  
  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}
exports.safely = safelyResolveThenable;
},{"./handlers":7,"./tryCatch":15}],14:[function(require,module,exports){
// Lazy man's symbols for states

exports.REJECTED = ['REJECTED'];
exports.FULFILLED = ['FULFILLED'];
exports.PENDING = ['PENDING'];
},{}],15:[function(require,module,exports){
'use strict';

module.exports = tryCatch;

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}
},{}],16:[function(require,module,exports){
'use strict';

var immediate = require('immediate');
var handlers = require('./handlers');
module.exports = unwrap;

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}
},{"./handlers":7,"immediate":17}],17:[function(require,module,exports){
'use strict';
var types = [
  require('./nextTick'),
  require('./mutation.js'),
  require('./messageChannel'),
  require('./stateChange'),
  require('./timeout')
];
var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}
var scheduleDrain;
var i = -1;
var len = types.length;
while (++ i < len) {
  if (types[i] && types[i].test && types[i].test()) {
    scheduleDrain = types[i].install(nextTick);
    break;
  }
}
module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}
},{"./messageChannel":18,"./mutation.js":19,"./nextTick":2,"./stateChange":20,"./timeout":21}],18:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  if (global.setImmediate) {
    // we can only get here in IE10
    // which doesn't handel postMessage well
    return false;
  }
  return typeof global.MessageChannel !== 'undefined';
};

exports.install = function (func) {
  var channel = new global.MessageChannel();
  channel.port1.onmessage = func;
  return function () {
    channel.port2.postMessage(0);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],19:[function(require,module,exports){
(function (global){
'use strict';
//based off rsvp https://github.com/tildeio/rsvp.js
//license https://github.com/tildeio/rsvp.js/blob/master/LICENSE
//https://github.com/tildeio/rsvp.js/blob/master/lib/rsvp/asap.js

var Mutation = global.MutationObserver || global.WebKitMutationObserver;

exports.test = function () {
  return Mutation;
};

exports.install = function (handle) {
  var called = 0;
  var observer = new Mutation(handle);
  var element = global.document.createTextNode('');
  observer.observe(element, {
    characterData: true
  });
  return function () {
    element.data = (called = ++called % 2);
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],20:[function(require,module,exports){
(function (global){
'use strict';

exports.test = function () {
  return 'document' in global && 'onreadystatechange' in global.document.createElement('script');
};

exports.install = function (handle) {
  return function () {

    // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
    // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
    var scriptEl = global.document.createElement('script');
    scriptEl.onreadystatechange = function () {
      handle();

      scriptEl.onreadystatechange = null;
      scriptEl.parentNode.removeChild(scriptEl);
      scriptEl = null;
    };
    global.document.documentElement.appendChild(scriptEl);

    return handle;
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],21:[function(require,module,exports){
'use strict';
exports.test = function () {
  return true;
};

exports.install = function (t) {
  return function () {
    setTimeout(t, 0);
  };
};
},{}],22:[function(require,module,exports){
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

var nodify = require("promise-nodify");

exports.installStaticWrapperMethods = function (PouchDB, handlers) {
  //set an 'alternative constructor' so the constructor can be easily
  //wrapped, since wrapping 'real' constructors is hard.
  PouchDB["new"] = PouchDB["new"] || function (name, options, callback) {
    return new PouchDB(name, options, callback);
  };

  installWrappers(PouchDB, handlers, exports.createStaticWrapperMethod);
};

exports.installWrapperMethods = function (db, handlers) {
  installWrappers(db, handlers, exports.createWrapperMethod);
};

function installWrappers(base, handlers, createWrapperMethod) {
  for (var name in handlers) {
    if (!handlers.hasOwnProperty(name)) {
      continue;
    }
    var info = getBaseAndName(base, name);
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
      info.base[info.name] = createWrapperMethod(name, original, handlers[name], base);
    }
  }
}

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

exports.createStaticWrapperMethod = function (name, original, handler, PouchDB) {
  //PouchDB is optional
  return createWrapper(name, original, handler, staticWrapperBuilders, PouchDB);
};

exports.createWrapperMethod = function (name, original, handler, db) {
  //db is optional
  return createWrapper(name, original, handler, wrapperBuilders, db);
};

function createWrapper(name, original, handler, theWrapperBuilders, thisVal) {
  //thisVal is optional
  var buildWrapper = theWrapperBuilders[name];
  if (typeof createWrapper === "undefined") {
    throw new Error("No known wrapper for method name: " + name); //coverage: ignore
  }
  var handlers = [handler];
  var wrapper = buildWrapper(thisVal, original, handlers);
  wrapper._original = original;
  wrapper._handlers = handlers;
  return wrapper;
}

var wrapperBuilders = {};

wrapperBuilders.destroy = function (db, destroy, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCall(destroy));
  };
};

wrapperBuilders.put = function (db, put, handlers) {
  return function (doc, docId, docRev, options, callback) {
    var args = {};
    args.base = db || this;
    args.db = db || this; //backwards compatibility
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

wrapperBuilders.post = function (db, post, handlers) {
  return function (doc, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.doc = doc;
    return callHandlers(handlers, args, function () {
      return post.call(this, args.doc, args.options);
    });
  };
};

wrapperBuilders.get = function (db, get, handlers) {
  return function(docId, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.docId = docId;
    return callHandlers(handlers, args, function () {
      return get.call(this, args.docId, args.options);
    });
  };
};

wrapperBuilders.remove = function (db, remove, handlers) {
  return function (docOrId, optsOrRev, opts, callback) {
    var args;

    //originally borrowed from PouchDB
    if (typeof optsOrRev === 'string') {
      // id, rev, opts, callback style
      args = parseBaseArgs(db, this, opts, callback);
      args.doc = {
        _id: docOrId,
        _rev: optsOrRev
      };
    } else {
      // doc, opts, callback style
      args = parseBaseArgs(db, this, optsOrRev, opts);
      args.doc = docOrId;
    }

    return callHandlers(handlers, args, function () {
      return remove.call(this, args.doc, args.options);
    });
  };
};

wrapperBuilders.bulkDocs = function (db, bulkDocs, handlers) {
  return function (docs, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    //support the deprecated signature.
    args.docs = docs.docs || docs;
    return callHandlers(handlers, args, function () {
      return bulkDocs.call(this, args.docs, args.options);
    });
  };
};

wrapperBuilders.allDocs = function (db, allDocs, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(allDocs, args));
  };
};

wrapperBuilders.changes = function (db, changes, handlers) {
  return function (options, callback) {
    //the callback argument is no longer documented. (And deprecated?)
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(changes, args));
  };
};

wrapperBuilders.sync = function (db, replicate, handlers) {
  return function (url, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.url = url;
    return callHandlers(handlers, args, function () {
      return replicate.call(this, args.url, args.options);
    });
  };
};

wrapperBuilders["replicate.from"] = wrapperBuilders.sync;
wrapperBuilders["replicate.to"] = wrapperBuilders.sync;

wrapperBuilders.putAttachment = function (db, putAttachment, handlers) {
  return function (docId, attachmentId, rev, doc, type, options, callback) {
    //options is not an 'official' argument. But some plug-ins need it
    //and maybe (?) also the http adapter.

    //valid calls:
    //- "id", "aid", "rev", new Blob(), "text/plain", {}, function () {}
    //- "id", "aid", new Blob(), "text/plain", {}, function () {}
    //- "id", "aid", new Blob(), "text/plain"
    var args;
    if (typeof type === "string") {
      //rev is specified
      args = parseBaseArgs(db, this, options, callback);
      args.rev = rev;
      args.doc = doc;
      args.type = type;
    } else {
      //rev is unspecified
      args = parseBaseArgs(db, this, type, options);
      args.rev = null;
      args.doc = rev;
      args.type = doc;
    }
    //fixed arguments
    args.docId = docId;
    args.attachmentId = attachmentId;

    return callHandlers(handlers, args, function () {
      return putAttachment.call(this, args.docId, args.attachmentId, args.rev, args.doc, args.type);
    });
  };
};

wrapperBuilders.getAttachment = function (db, getAttachment, handlers) {
  return function (docId, attachmentId, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    return callHandlers(handlers, args, function () {
      return getAttachment.call(this, args.docId, args.attachmentId, args.options);
    });
  };
};

wrapperBuilders.removeAttachment = function (db, removeAttachment, handlers) {
  return function (docId, attachmentId, rev, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db, this, options, callback);
    args.docId = docId;
    args.attachmentId = attachmentId;
    args.rev = rev;
    return callHandlers(handlers, args, function () {
      return removeAttachment.call(this, args.docId, args.attachmentId, args.rev);
    });
  };
};

wrapperBuilders.query = function (db, query, handlers) {
  return function (fun, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.fun = fun;
    return callHandlers(handlers, args, function () {
      return query.call(this, args.fun, args.options);
    });
  };
};

wrapperBuilders.viewCleanup = function (db, viewCleanup, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(viewCleanup, args));
  };
};

wrapperBuilders.info = function (db, info, handlers) {
  return function (options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCall(info));
  };
};

wrapperBuilders.compact = function (db, compact, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(compact, args));
  };
};

wrapperBuilders.revsDiff = function (db, revsDiff, handlers) {
  return function (diff, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db, this, options, callback);
    args.diff = diff;
    return callHandlers(handlers, args, function () {
      return revsDiff.call(this, args.diff);
    });
  };
};

//Plug-in wrapperBuilders; only of the plug-ins for which a wrapper
//has been necessary.

wrapperBuilders.list = function (db, orig, handlers) {
  return function (path, options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    args.path = path;

    return callHandlers(handlers, args, function () {
      return orig.call(this, args.path, args.options);
    });
  };
};

wrapperBuilders.rewriteResultRequestObject = wrapperBuilders.list;
wrapperBuilders.show = wrapperBuilders.list;
wrapperBuilders.update = wrapperBuilders.list;

wrapperBuilders.getSecurity = function (db, getSecurity, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(db, this, options, callback);
    return callHandlers(handlers, args, makeCallWithOptions(getSecurity, args));
  };
};

wrapperBuilders.putSecurity = function (db, putSecurity, handlers) {
  return function (secObj, options, callback) {
    //see note on the options argument at putAttachment.
    var args = parseBaseArgs(db, this, options, callback);
    args.secObj = secObj;
    return callHandlers(handlers, args, function () {
      return putSecurity.call(this, args.secObj);
    });
  };
};

//static
var staticWrapperBuilders = {};

staticWrapperBuilders["new"] = function (PouchDB, construct, handlers) {
  return function (name, options, callback) {
    var args;
    if (typeof name === "object") {
      args = parseBaseArgs(PouchDB, this, name, options);
    } else {
      args = parseBaseArgs(PouchDB, this, options, callback);
      args.options.name = name;
    }
    return callHandlers(handlers, args, function () {
      return construct.call(this, args.options);
    });
  };
};

staticWrapperBuilders.destroy = function (PouchDB, destroy, handlers) {
  return function (name, options, callback) {
    var args;
    if (typeof name === "object") {
      args = parseBaseArgs(PouchDB, this, name, options);
    } else {
      args = parseBaseArgs(PouchDB, this, options, callback);
      args.options.name = name;
    }
    return callHandlers(handlers, args, function () {
      var name = args.options.name;
      delete args.options.name;
      return destroy.call(this, name, args.options);
    });
  };
};

staticWrapperBuilders.replicate = function (PouchDB, replicate, handlers) {
  return function (source, target, options, callback) {
    //no callback
    var args = parseBaseArgs(PouchDB, this, options, callback);
    args.source = source;
    args.target = target;
    return callHandlers(handlers, args, function () {
      return replicate.call(this, args.source, args.target, args.options);
    });
  };
};

staticWrapperBuilders.allDbs = function (PouchDB, allDbs, handlers) {
  return function (options, callback) {
    var args = parseBaseArgs(PouchDB, this, options, callback);
    return callHandlers(handlers, args, makeCall(allDbs));
  }
};

//Wrap .plugin()? .on()? .defaults()? No use case yet, but it's
//possible...

function parseBaseArgs(thisVal1, thisVal2, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return {
    base: thisVal1 || thisVal2,
    db: thisVal1 || thisVal2, //backwards compatibility
    options: options || {},
    callback: callback
  };
}

function callHandlers(handlers, args, method) {
  var callback = args.callback;
  delete args.callback;

  //build a chain of handlers: the bottom handler calls the 'real'
  //method, the other handlers call other handlers.
  method = method.bind(args.base);
  for (var i = handlers.length - 1; i >= 0; i -= 1) {
    method = handlers[i].bind(null, method, args);
  }
  //start running the chain.
  var promise = method();
  nodify(promise, callback);
  return promise;
}

function makeCall(func) {
  return function () {
    return func.call(this);
  };
}

function makeCallWithOptions(func, args) {
  return function () {
    return func.call(this, args.options);
  };
}

exports.uninstallWrapperMethods = function (db, handlers) {
  uninstallWrappers(db, handlers);
};

exports.uninstallStaticWrapperMethods = function (PouchDB, handlers) {
  uninstallWrappers(PouchDB, handlers);
};

function uninstallWrappers(base, handlers) {
  for (var name in handlers) {
    if (!handlers.hasOwnProperty(name)) {
      continue;
    }
    var info = getBaseAndName(base, name);
    var wrapper = info.base[info.name];
    if (typeof wrapper === "undefined") {
      //method doesn't exist, so was never wrapped in the first place.
      continue;
    }

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
}

},{"promise-nodify":23}],23:[function(require,module,exports){
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

module.exports = function nodify(promise, callback) {
  if (typeof callback === "function") {
    promise.then(function (resp) {
      callback(null, resp);
    }, function (err) {
      callback(err, null);
    });
  }
};

},{}]},{},[1])(1)
});