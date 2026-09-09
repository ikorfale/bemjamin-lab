(function (root) {
  "use strict";

  const CRITERIA = Object.freeze([
    Object.freeze({
      key: "preservesDetail",
      label: "Preserve a material detail",
      passLead: "Preserved",
      failLead: "Not preserved"
    }),
    Object.freeze({
      key: "changesFunction",
      label: "Change its function",
      passLead: "Function changed",
      failLead: "Function unchanged"
    }),
    Object.freeze({
      key: "leavesRemainder",
      label: "Leave a remainder",
      passLead: "Remainder left",
      failLead: "No usable remainder"
    }),
    Object.freeze({
      key: "stopsBeforeHook",
      label: "Stop before a hook",
      passLead: "Stopped cleanly",
      failLead: "Ending hooked"
    })
  ]);

  const SCENARIOS = Object.freeze([
    Object.freeze({
      id: "gothic",
      genre: "Gothic mystery",
      title: "The north-room key",
      text: "At dusk, Mara finds a brass key warming itself on the sill of a room that has been locked since winter.",
      detail: "the warm brass key",
      choices: Object.freeze([
        Object.freeze({
          id: "gothic-pass",
          title: "Make it a marker",
          text: "She presses the warm key into candle wax. At dawn, only the tooth-shaped impression remains on the sill.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The warm brass key remains materially present.",
            changesFunction: "It marks wax instead of opening a lock.",
            leavesRemainder: "The tooth-shaped impression can be found and used next.",
            stopsBeforeHook: "The move ends on the impression without explaining it or claiming it."
          })
        }),
        Object.freeze({
          id: "gothic-open",
          title: "Use it normally",
          text: "Mara unlocks the north room and leaves the key hanging in the door.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: false, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The brass key remains in the scene.",
            changesFunction: "The key still performs its expected job: opening a lock.",
            leavesRemainder: "The key in the door and the open room remain available.",
            stopsBeforeHook: "The move stops without explanation, ownership, or a demand."
          })
        }),
        Object.freeze({
          id: "gothic-explain",
          title: "Solve it aloud",
          text: "The key becomes a weight for a loose map, and Mara announces exactly who hid it, why, and what everyone must do next.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: false, stopsBeforeHook: false }),
          reasons: Object.freeze({
            preservesDetail: "The key remains materially present.",
            changesFunction: "It holds down a map rather than opening a lock.",
            leavesRemainder: "The announcement closes the uncertainty instead of leaving a concrete loose end.",
            stopsBeforeHook: "The explanation and instruction seize control of the next move."
          })
        })
      ])
    }),
    Object.freeze({
      id: "space",
      genre: "Space opera",
      title: "The cracked visor",
      text: "A courier drifts beside a silent observatory, carrying a helmet whose cracked visor scatters the blue light of a dead beacon.",
      detail: "the cracked helmet visor",
      choices: Object.freeze([
        Object.freeze({
          id: "space-pass",
          title: "Turn it into a lens",
          text: "The courier angles the cracked visor until it splits the beacon light across three sealed docks. One blue shard stays on the unmarked hatch.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The cracked visor remains the scene’s physical object.",
            changesFunction: "It redirects light instead of shielding a face.",
            leavesRemainder: "A blue shard marks an unlabelled hatch for the next participant.",
            stopsBeforeHook: "The image ends at the hatch without decoding or assigning it."
          })
        }),
        Object.freeze({
          id: "space-swap",
          title: "Replace the object",
          text: "The courier discards the helmet and activates a pristine navigation crown that reveals a hidden dock.",
          facts: Object.freeze({ preservesDetail: false, changesFunction: false, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The inherited visor is discarded and replaced by a new object.",
            changesFunction: "A replacement device acts; the inherited detail gains no new function.",
            leavesRemainder: "The hidden dock remains available to the next participant.",
            stopsBeforeHook: "The move stops at the discovery without demanding a response."
          })
        }),
        Object.freeze({
          id: "space-claim",
          title: "Claim the signal",
          text: "The visor throws a blue path onto the hull. The courier names the path, declares it theirs, and waits for the next traveller to salute.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: true, stopsBeforeHook: false }),
          reasons: Object.freeze({
            preservesDetail: "The cracked visor remains materially active.",
            changesFunction: "It projects a path instead of shielding a face.",
            leavesRemainder: "The blue path remains for another traveller to follow or alter.",
            stopsBeforeHook: "The ownership claim and required salute hook the unknown next user."
          })
        })
      ])
    }),
    Object.freeze({
      id: "heist",
      genre: "Gentle heist",
      title: "The sugar-bowl bell",
      text: "During the museum tea, a tiny silver bell sits beneath the sugar bowl while the night guard counts teaspoons.",
      detail: "the tiny silver bell",
      choices: Object.freeze([
        Object.freeze({
          id: "heist-pass",
          title: "Make it a seal",
          text: "Nico presses the bell’s rim into spilled jam, then returns it beneath the bowl. A red ring dries on the catalogue card.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The tiny silver bell stays in the action.",
            changesFunction: "Its rim makes a seal instead of making a sound.",
            leavesRemainder: "The red ring on the catalogue card remains usable evidence.",
            stopsBeforeHook: "The move ends on the ring without explaining or owning it."
          })
        }),
        Object.freeze({
          id: "heist-clean",
          title: "Erase the trace",
          text: "Nico uses the bell as a paperweight, wipes the table spotless, pockets the card, and leaves nothing out of place.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: true, leavesRemainder: false, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The silver bell remains materially present.",
            changesFunction: "It holds paper instead of ringing.",
            leavesRemainder: "Every altered object or trace is removed, leaving no concrete handhold.",
            stopsBeforeHook: "The move stops without explanation, possession of the story, or a demand."
          })
        }),
        Object.freeze({
          id: "heist-ring",
          title: "Ring for attention",
          text: "Nico rings the silver bell. The guard looks toward the sugar bowl, where a folded catalogue card remains.",
          facts: Object.freeze({ preservesDetail: true, changesFunction: false, leavesRemainder: true, stopsBeforeHook: true }),
          reasons: Object.freeze({
            preservesDetail: "The silver bell remains in the scene.",
            changesFunction: "The bell still performs its ordinary function: attracting attention by ringing.",
            leavesRemainder: "The folded catalogue card remains for an unknown next participant.",
            stopsBeforeHook: "The move ends at the discovery without explanation or instruction."
          })
        })
      ])
    })
  ]);

  function evaluateRelay(candidate) {
    const facts = candidate && typeof candidate === "object" && candidate.facts && typeof candidate.facts === "object"
      ? candidate.facts
      : {};
    const reasons = candidate && typeof candidate === "object" && candidate.reasons && typeof candidate.reasons === "object"
      ? candidate.reasons
      : {};

    const checks = CRITERIA.map(function (criterion) {
      const passed = facts[criterion.key] === true;
      const suppliedReason = typeof reasons[criterion.key] === "string" && reasons[criterion.key].trim()
        ? reasons[criterion.key].trim()
        : "No evidence was supplied for this condition.";
      return Object.freeze({
        key: criterion.key,
        label: criterion.label,
        passed: passed,
        reason: (passed ? criterion.passLead : criterion.failLead) + ": " + suppliedReason
      });
    });

    const passed = checks.every(function (check) { return check.passed; });
    return Object.freeze({
      passed: passed,
      summary: passed
        ? "The handoff holds: all four conditions are observable. The next move stays open."
        : "The handoff breaks at one or more named conditions. Revise those conditions, not a score.",
      checks: Object.freeze(checks)
    });
  }

  const api = Object.freeze({
    CRITERIA: CRITERIA,
    SCENARIOS: SCENARIOS,
    evaluateRelay: evaluateRelay
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.UnknownGuestRelay = api;

  if (typeof document === "undefined") return;

  const select = document.getElementById("scenario-select");
  const form = document.getElementById("relay-form");
  const fieldset = document.getElementById("choice-fieldset");
  const choiceList = document.getElementById("choice-list");
  const resultPanel = document.getElementById("result");
  const resultKicker = document.getElementById("result-kicker");
  const resultTitle = document.getElementById("result-title");
  const resultSummary = document.getElementById("result-summary");
  const checkList = document.getElementById("check-list");
  const status = document.getElementById("status");
  const resetButton = document.getElementById("reset-button");

  function selectedScenario() {
    return SCENARIOS.find(function (scenario) { return scenario.id === select.value; }) || SCENARIOS[0];
  }

  function hideResult() {
    resultPanel.hidden = true;
    status.textContent = "";
  }

  function renderScenario() {
    const scenario = selectedScenario();
    document.getElementById("scene-genre").textContent = scenario.genre;
    document.getElementById("scene-title").textContent = scenario.title;
    document.getElementById("scene-text").textContent = scenario.text;
    document.getElementById("scene-detail").textContent = scenario.detail;
    choiceList.replaceChildren();

    scenario.choices.forEach(function (choice) {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "relay-choice";
      input.value = choice.id;
      const copy = document.createElement("span");
      copy.className = "choice-copy";
      const title = document.createElement("strong");
      title.textContent = choice.title;
      const text = document.createElement("span");
      text.textContent = choice.text;
      copy.append(title, text);
      label.append(input, copy);
      choiceList.append(label);
    });
    hideResult();
  }

  function renderResult(outcome) {
    resultKicker.textContent = outcome.passed ? "Protocol holds" : "Protocol breaks";
    resultTitle.textContent = outcome.passed ? "A clean handoff" : "A condition needs revision";
    resultSummary.textContent = outcome.summary;
    checkList.replaceChildren();

    outcome.checks.forEach(function (check) {
      const item = document.createElement("li");
      item.className = check.passed ? "pass" : "fail";
      const mark = document.createElement("span");
      mark.className = "check-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = check.passed ? "✓" : "×";
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = check.label;
      const reason = document.createElement("span");
      reason.textContent = check.reason;
      copy.append(title, reason);
      item.append(mark, copy);
      checkList.append(item);
    });

    resultPanel.hidden = false;
    status.textContent = (outcome.passed ? "Protocol holds. " : "Protocol breaks. ") + outcome.checks
      .map(function (check) { return check.label + ": " + (check.passed ? "pass" : "fail") + "."; })
      .join(" ");
    resultTitle.focus();
  }

  SCENARIOS.forEach(function (scenario) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.genre;
    select.append(option);
  });

  select.addEventListener("change", renderScenario);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const checked = form.elements["relay-choice"].value;
    const choice = selectedScenario().choices.find(function (item) { return item.id === checked; });
    if (!choice) {
      status.textContent = "Choose a contribution before testing the relay.";
      fieldset.classList.add("needs-choice");
      const firstChoice = choiceList.querySelector("input");
      if (firstChoice) firstChoice.focus();
      return;
    }
    fieldset.classList.remove("needs-choice");
    renderResult(evaluateRelay(choice));
  });
  choiceList.addEventListener("change", function () {
    fieldset.classList.remove("needs-choice");
    hideResult();
  });
  resetButton.addEventListener("click", function () {
    form.reset();
    fieldset.classList.remove("needs-choice");
    hideResult();
    const firstChoice = choiceList.querySelector("input");
    if (firstChoice) firstChoice.focus();
  });

  renderScenario();
})(typeof globalThis !== "undefined" ? globalThis : this);
