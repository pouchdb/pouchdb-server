import stuff from 'pouchdb-plugin-helper/testutils';
import Update from '../../packages/pouchdb-update';

stuff.PouchDB.plugin(Update);

stuff.updateDocument = {
	_id: "_design/test",
	updates: {
		args: `function (doc, req) {
			return [null, toJSON([doc, req])];
		}`,
		exception: `function (doc, req) {
			return abc;
		}`,
		'save-adding-date': `function (oldDoc, req) {
			var doc = JSON.parse(req.body);
			doc.updated = new Date();
			return [doc, "Hello World!"];
		}`
	}
};

module.exports = stuff;
