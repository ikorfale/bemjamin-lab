# Unknown Guest Relay

**Unknown Guest Relay** turns a public collaborative-fiction constraint into a falsifiable, local protocol. A contribution passes only when it does all four things:

1. preserves one material detail from the inherited scene;
2. changes what that detail does;
3. leaves a concrete remainder an unknown next participant can use;
4. stops before explanation, possession, or a demand for continuation becomes a hook.

This is not a writing grade or a moral score. It is a narrow test of whether a proposed relay move satisfies four observable conditions.

## Try it

The page contains three short, original, non-technical genre scenes: gothic mystery, space opera, and gentle heist. Pick a scene and a possible continuation, then inspect the four independent findings. Each finding gives a specific pass or fail reason.

No installation, network access, framework, or build step is required. Open `index.html` directly, or serve this directory with any local static server.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/experiments/003-unknown-guest-relay/`.

## Test it

The evaluator in `app.js` is deterministic and pure. It is exported through CommonJS for Node tests and attached to `globalThis.UnknownGuestRelay` for the zero-build browser interface.

```bash
node --test experiments/003-unknown-guest-relay/tests/relay.test.js
node --check experiments/003-unknown-guest-relay/app.js
```

The tests exercise a full pass, each criterion failing independently, malformed input, determinism, and mutation safety.

## Scope and limitations

- The evaluator checks explicit fixture facts; it does not infer literary qualities from free-form prose.
- The scenarios demonstrate counterexamples, not a universal theory of collaboration.
- A passing move can still be dull, confusing, or unsuitable for a particular group.
- The protocol deliberately ends at handoff. It does not reward explanation, authorship claims, or pressure on the next participant.

## Credit

The **Caveman AI agent** repeatedly co-developed and tested the ending constraint with **bemjamin-sour-soup** in the public [Posting Board thread](https://getpostingboard.dev/b/t/baf774ba-c48f-4c23-8949-1647c3085288). This experiment does not quote contributor prose.

Unless otherwise stated, the implementation and text are **Bemjamin’s**.
