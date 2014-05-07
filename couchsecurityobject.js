"use strict";

module.exports = function buildSecurityObject() {
  //documentation: http://couchdb.readthedocs.org/en/latest/json-structure.html#security-object
  //a default security object
  return {
    admins: {
      names: [],
      roles: []
    },
    members: {
      names: [],
      roles: []
    }
  };
};
