import Validation from '../';
import stuff from 'pouchdb-plugin-helper/testutils';

stuff.PouchDB.plugin(Validation);
stuff.onlyTestValidationDoc = {
	_id: '_design/test',
	validate_doc_update: `function (newDoc, oldDoc, userCtx, secObj) {
		if (newDoc._id !== "test") {
			throw({forbidden: "only a document named 'test' is allowed."});
		}
	}`
};

module.exports = stuff;
