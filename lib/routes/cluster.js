'use strict';

var utils = require('../utils');

module.exports = function (app) {

  // there is only one node, but these APIs
  // are required for fauxton
  app.get('/_membership', function (req, res, next) {
    utils.sendJSON(res, 200, {
      all_nodes: ['node1@127.0.0.1'],
      cluster_nodes: ['node1@127.0.0.1']
    });
  });

  app.get('/_cluster_setup', function (req, res, next) {
    utils.sendJSON(res, 201, {
      state: 'cluster_disabled'
    });
  });
};
