'use strict';
const { policyForkFixture } = require('./fixtures');
const { comparePolicies } = require('./core');
const result = comparePolicies(policyForkFixture().input);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
