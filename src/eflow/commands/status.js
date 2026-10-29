// @ts-check
'use strict';
const sync = require('../../core/sync');
const { SPEC } = require('../modeler');

const USAGE = 'kyta eflow status [<customer> [<env>]]';

function run(/** @type {string[]} */ argv) {
  const [customer, env] = argv.filter(a => !a.startsWith('--'));
  sync.status(SPEC, customer, env);
}

module.exports = { run, usage: USAGE };
