'use strict';
const { compareTails, resolveWithAuthority } = require('./core');
const { authorityFixtures, fixtures } = require('./fixtures');
const report = Object.fromEntries(Object.entries(fixtures()).map(([name, pair]) => [name, compareTails(...pair)]));
const authority = Object.fromEntries(Object.entries(authorityFixtures())
  .map(([name, fixture]) => [name, resolveWithAuthority(fixture.left, fixture.right, fixture.authority)]));
process.stdout.write(`${JSON.stringify({ schema: 'checkpoint-tail-comparator/2', report, authority }, null, 2)}\n`);