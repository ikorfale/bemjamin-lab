'use strict';
const { compareTails } = require('./core');
const { fixtures } = require('./fixtures');
const report = Object.fromEntries(Object.entries(fixtures()).map(([name, pair]) => [name, compareTails(...pair)]));
process.stdout.write(`${JSON.stringify({ schema: 'checkpoint-tail-comparator/1', report }, null, 2)}\n`);
