# express-pouchdb

> An Express submodule with a CouchDB style REST interface to PouchDB.

## Introduction

The **express-pouchdb** module is a fully qualified [Express](http://expressjs.com/) application with routing defined to 
mimic most of the [CouchDB](http://couchdb.apache.org/) REST API, and whose behavior is handled by 
[PouchDB](http://pouchdb.com/). The intention is for **express-pouchdb** to be mounted into other Express apps for 
extended usability. A simple example of this is [pouchdb-server](https://github.com/nick-thompson/pouchdb-server), 
which is primarily used as a quick-and-dirty drop-in replacement for CouchDB in Node.js.

## Screencasts

* [Modular web applications with Node.js and Express](http://vimeo.com/56166857)

## Installation

```bash
$ npm install express-pouchdb
```

## Example Usage

Here's a sample Express app, which we'll name `app.js`.

```javascript
var express = require('express')
  , app     = express()
  , PouchDB = require('pouchdb');

app.use(express.logger('tiny'));
app.use('/db', require('express-pouchdb')(PouchDB));

app.listen(3000);
```

Now we can run this little guy and find each of `express-pouch`'s routes at the `/db` prefix.

```bash
$ node app.js &
$ curl http://localhost:3000/db/
GET / 200 56 - 7 ms
{
  "express-pouchdb": "Welcome!",
  "version": "0.2.0"
}
```

*Note,* **express-pouchdb** bundles its own JSON parsing middleware which conflicts with 
[`express.bodyParser()`](http://expressjs.com/api.html#bodyParser). Please avoid using `express.bodyParser()`. Rather,
you can use `express.urlencoded()` and `express.multipart()` alongside the **express-pouchdb** JSON middleware 
and you should find the results to be the same as you would have expected with `express.bodyParser()`.

```javascript
app.use(express.urlencoded());
app.use(express.multipart());
app.use(require('express-pouchdb')(require('pouchdb')));
```

### Using your own PouchDB

Since you pass in the `PouchDB` that you would like to use with express-pouchb, you can drop
express-pouchdb into an existing Node-based PouchDB application and get all the benefits of the HTTP interface without having to change your code.

```js
var express = require('express')
  , app     = express()
  , PouchDB = require('pouchdb');

app.use('/db', require('express-pouchdb')(PouchDB));

var myPouch = new PouchDB('foo');

// myPouch is now modifiable in your own code, and it's also
// available via HTTP at /db/foo
```

### PouchDB defaults

When you use your own PouchDB code in tandem with express-pouchdb, the `PouchDB.defaults()` API can be very convenient for specifying some default settings for how PouchDB databases are created.

For instance, if you want to use an in-memory [MemDOWN](https://github.com/rvagg/memdown)-backed pouch, you can simply do:

```js
var InMemPouchDB = PouchDB.defaults({db: require('memdown')});

app.use('/db', require('express-pouchdb')(InMemPouchDB));

var myPouch = new InMemPouchDB('foo');
```

Similarly, if you want to place all database files in a folder other than the `pwd`, you can do:

```js
var TempPouchDB = PouchDB.defaults({prefix: '/tmp/my-temp-pouch/'});

app.use('/db', require('express-pouchdb')(TempPouchDB));

var myPouch = new TempPouchDB('foo');
```

## Contributing

Want to help me make this thing awesome? Great! Here's how you should get started.

1. Because PouchDB is still developing so rapidly, you'll want to clone `git@github.com:daleharvey/pouchdb.git`, and run `npm link` from the root folder of your clone.
2. Fork **express-pouchdb**, and clone it to your local machine.
3. From the root folder of your clone run `npm link pouchdb` to install PouchDB from your local repository from Step 1.
4. `npm install`

Please make your changes on a separate branch whose name reflects your changes, push them to your fork, and open a pull request!
I haven't defined a formal styleguide, so please take care to maintain the existing coding style.

## Contributors

A huge thanks goes out to all of the following people for helping me get this to where it is now.

* Dale Harvey ([@daleharvey](https://github.com/daleharvey))
* Nolan Lawson ([@nolanlawson](https://github.com/nolanlawson)) 
* Ryan Ramage ([@ryanramage](https://github.com/ryanramage))
* Garren Smith ([@garrensmith](https://github.com/garrensmith))
* ([@copongcopong](https://github.com/copongcopong))
* ([@zevero](https://github.com/zevero))

## License

Copyright (c) 2013 Nick Thompson

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

