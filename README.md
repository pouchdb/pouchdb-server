# pouchdb-auth

> A PouchDB plug-in that simulates CouchDB's authentication daemon.

Includes a users db that functions like CouchDB's.

## Usage

```
# npm install --save pouchdb-auth
var PouchDB = require('pouchdb')
var Auth = require('pouchdb-auth')
PouchDB.plugin(Auth)

var db = new PouchDB('_users')
```

`pouchdb-auth` adds 3 methods to the PouchDB API

1. `db.hashAdminPasswords(admins)`
2. `db.useAsAuthenticationDB()`
3. `db.stopUsingAsAuthenticationDB`


### db.hashAdminPasswords(admins[, callback])

`admins` is an object in the form of `'username': 'password'`.

Returns a promise, unless `callback` is passed.
Resolves with object with all values being hashed.

```js
db.hashAdminPasswords({ 'admin': 'secret' }
.then(function (hashed) {
  // hashed.admin now looks like '-pbkdf2-243ba92f8f575c70d3d607b408…21731411301c11cb1d81481f51d1108,10'
})
```

See below ("How it works") for more background information


### db.useAsAuthenticationDB([isOnlineAuthDB[, callback]])

This function transforms the database on which it is called into an
authentication database. It does that by installing strict validation
rules, making sure passwords are hashed in user documents before
they're written into the db, and by adding the following methods
to the db (documented below):

- `db.signUp(username, password[, options[, callback]])`
- `db.logIn(username, password[, options[, callback]])`
- `db.logOut(options[, callback])`
- `db.session(options[, callback])`

`isOnlineAuthDB`: If `true`, password hashing, keeping
track of the session and doc validation is all handled by the
CouchDB on the other end. Defaults to `true` if called on an http
database, otherwise `false`. Having this enabled makes it impossible to
use the `options.sessionID` option in methods that support it.

Returns a promise, unless `callback` is passed. Resolves with nothing.

```js
db.useAsAuthenticationDB()
.then(function () {
  // db is now ready to be used as users database, with all behavior
  // of CouchDB's `_users` database applied

})
```

### db.stopUsingAsAuthenticationDB([callback])

Removes custom behavior and methods applied by `db.useAsAuthenticationDB()`.

Returns a promise, unless `callback` is passed. Resolves with nothing.

```js
db.useAsAuthenticationDB()
.then(function () {})
```


### db.signUp(username, password[, options[, callback]])

A small helper function: pretty much equivalent to saving a
CouchDB user document with the passed in values in the database
using PouchDB.

`username` and `password` are both strings and required.

`options.roles` (optional) is an array of strings with roles
names, used for authorizing access to databases, see "How it
works" below.

Returns a promise, unless `callback` is passed. Resolves with
[put](http://pouchdb.com/api.html#create_document) response.

```js
db.signUp('john', 'secret')
.then(function (response) {
  // {
  //   ok: true,
  //   id: 'org.couchdb.user:john',
  //   rev: '1-A6157A5EA545C99B00FF904EEF05FD9F'
  // }
})
```

### db.logIn(username, password[, options[, callback]])

Tries to get the user specified by `username` from the database,
if its `password` (after hashing) matches, the user is considered
to be logged in. This fact is then saved to a db, allowing the
other methods (`db.logOut` & `db.session`) to use it later on.

- `options.sessionID` (optional, default `"default"`)

  Under this key the session is saved to a db.
  This allows you to have multiple sessions
  running alongside each other.

` `options.admins` (optional)

  Allows to pass in an admins object that looks
  like the one defined in CouchDB's `_config`.

Returns a promise, unless `callback` is passed. Resolves with `name`
and `roles`. If username and/or password is incorrect, rejects with
`unauthorized` error.

```js
db.logIn('john', 'secret')
.then(function (response) {
  // {
  //   ok: true,
  //   name: 'username',
  //   roles: ['roles', 'here']
  // }
})

db.logIn('john', 'wrongsecret')
.catch(function (error) {
  // error.name === `unauthorized`
  // error.status === 401
  // error.message === 'Name or password is incorrect.'
})
```


### db.logOut([options[, callback]])

Removes the current session.

Returns a promise, unless `callback` is passed.

```js
db.logOut()
.then(function (response) {
  // { ok: true }
})


### db.session([options[, callback]])

Reads the current session from the db.

- `options.sessionID` (optional, default `"default"`)

  Under this key the session is saved to a db.
  This allows you to have multiple sessions
  running alongside each other.

` `options.admins` (optional)

  Allows to pass in an admins object that looks
  like the one defined in CouchDB's `_config`.

Returns a promise, unless `callback` is passed. Note that
`db.session()` does not return an error if the current
user has no valid session, just like CouchDB`s `GET /_session`
returns a `200` status. To determine whether the current user
has a valid session or not, check if `response.userCtx.name`
is set.

```js
db.session()
.then(function (response) {
  // {
  //   "ok": true,
  //   "userCtx": {
  //     "name": null,
  //     "roles": [],
  //   },
  //   "info": {
  //     "authentication_handlers": ["api"]
  //   }
  // }
})
```


## How it works

First, make sure you understand how the `_users` database works in
CouchDB. A good start is [the CouchDB documentation on the
authentication database](http://docs.couchdb.org/en/latest/intro/security.html#authentication-database)

Admin users are not stored in the `_users` database, but in the `[admins]` section
of couch.ini, see http://docs.couchdb.org/en/latest/config/auth.html

When setting passwords clear text, CouchDB will automatically overwrite
them with hashed passwords on restart.

The `roles` property of `_users` documents is used by CouchDB to determine access to databases,
which can be set in each database's `_security` setting. There are now default roles by CouchDB,
so you are free to set your own (With the excepion of system roles starting with a `_`). The
`roles` property can only be changed by CouchDB admin users. More on authorization in CouchDB:
http://docs.couchdb.org/en/latest/intro/security.html#authorization

### License

Apache-2.0
