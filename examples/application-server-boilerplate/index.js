var http = require('axios');
var read = require('read-yaml');
var PouchDB = require('pouchdb');
var express = require('express');
var app = express();
var config = read.sync('./config.yml');

const DB_URL = `${config.protocol}${config.domain}:${config.port}${config.dbServerEndpoint}`
const DB_ADMIN_URL = `${config.protocol}${config.admin.username}:${config.admin.password}@${config.domain}:${config.port}${config.dbServerEndpoint}`

app.use(config.dbServerEndpoint, require('express-pouchdb')(PouchDB.defaults({prefix: './db/'})));
app.listen(config.port);

async function setup() {
  try {
    await http.put(`${DB_URL}/_config/admins/${config.admin.username}`, config.admin.password);
    await http.put(`${DB_ADMIN_URL}/app`);
  }
  catch (err) {
    console.log(err); 
  }
}
setup();
