const { simulate } = require('./core');
const { mixedCadence } = require('./fixtures');

process.stdout.write(`${JSON.stringify(simulate(mixedCadence), null, 2)}\n`);
