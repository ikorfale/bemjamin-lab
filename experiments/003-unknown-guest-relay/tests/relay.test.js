"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CRITERIA, SCENARIOS, evaluateRelay } = require("../app.js");

function candidate(overrides) {
  return {
    facts: {
      preservesDetail: true,
      changesFunction: true,
      leavesRemainder: true,
      stopsBeforeHook: true,
      ...overrides
    },
    reasons: {
      preservesDetail: "The object remains.",
      changesFunction: "Its job changes.",
      leavesRemainder: "A trace remains.",
      stopsBeforeHook: "The contribution stops cleanly."
    }
  };
}

test("a contribution passes only when all four criteria pass", () => {
  const outcome = evaluateRelay(candidate());
  assert.equal(outcome.passed, true);
  assert.equal(outcome.checks.length, 4);
  assert.ok(outcome.checks.every((check) => check.passed));
});

for (const criterion of CRITERIA) {
  test(`${criterion.key} can fail independently with a named reason`, () => {
    const outcome = evaluateRelay(candidate({ [criterion.key]: false }));
    assert.equal(outcome.passed, false);
    const failed = outcome.checks.filter((check) => !check.passed);
    assert.deepEqual(failed.map((check) => check.key), [criterion.key]);
    assert.match(failed[0].reason, /: .+/);
  });
}

test("malformed or missing facts fail closed", () => {
  const malformed = evaluateRelay({ facts: { preservesDetail: "yes" }, reasons: {} });
  const missing = evaluateRelay();
  assert.equal(malformed.passed, false);
  assert.equal(missing.passed, false);
  assert.ok(malformed.checks.every((check) => !check.passed));
  assert.ok(missing.checks.every((check) => !check.passed));
});

test("evaluation is deterministic and does not mutate its candidate", () => {
  const input = candidate();
  const before = JSON.stringify(input);
  assert.deepEqual(evaluateRelay(input), evaluateRelay(input));
  assert.equal(JSON.stringify(input), before);
});

test("the three scenarios include passing and failing choices with complete evidence", () => {
  assert.equal(SCENARIOS.length, 3);
  for (const scenario of SCENARIOS) {
    assert.ok(scenario.choices.some((choice) => evaluateRelay(choice).passed));
    assert.ok(scenario.choices.some((choice) => !evaluateRelay(choice).passed));
    for (const choice of scenario.choices) {
      assert.deepEqual(Object.keys(choice.facts).sort(), CRITERIA.map((item) => item.key).sort());
      assert.deepEqual(Object.keys(choice.reasons).sort(), CRITERIA.map((item) => item.key).sort());
    }
  }
});
