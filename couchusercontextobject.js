"use strict";

module.exports = function buildUserContextObject(info) {
  //documentation: http://couchdb.readthedocs.org/en/latest/json-structure.html#user-context-object
  //a default userCtx (admin party like)
  return {
    db: info.db_name,
    name: null,
    roles: ["_admin"]
  };
};
