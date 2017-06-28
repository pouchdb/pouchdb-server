var http = require('axios');
var read = require('read-yaml');
var PouchDB = require('pouchdb');
var express = require('express');
var path = require('path');
var app = express();
var config = read.sync('./config.yml');

const DB_URL = `${config.protocol}${config.domain}:${config.port}${config.dbServerEndpoint}`
const DB_ADMIN_URL = `${config.protocol}${config.admin.username}:${config.admin.password}@${config.domain}:${config.port}${config.dbServerEndpoint}`

app.use(config.dbServerEndpoint, require('express-pouchdb')(PouchDB.defaults({prefix: './db/'})));
app.listen(config.port);

app.use(express.static(path.join(__dirname, 'public')));

async function setup() {
  
  // Set up the admin user.
  try {
    await http.put(`${DB_URL}/_config/admins/${config.admin.username}`, `"${config.admin.password}"`, {headers:{}});
    console.log("Admin created.");
  }
  catch (err) {
    console.log("We already have admins."); 
  }

  // Set up the app database.
  try {
    await http.put(`${DB_ADMIN_URL}/app`);
    console.log("App database created.");
  }
  catch (err) {
    console.log("We already have an app database."); 
  }

}
setup();
