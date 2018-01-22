import stuff from 'pouchdb-plugin-helper/testutils';
import SeamlessAuth from '../';

stuff.waitUntilReady = () => SeamlessAuth(stuff.PouchDB);

stuff.cleanup = async function () {
  await new stuff.PouchDB('_users').destroy();
}

module.exports = stuff;
