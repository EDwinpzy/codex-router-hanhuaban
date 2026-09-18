import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_HEALTH_TIMEOUT_MS, readControlHealth } from "../src/control-health.mjs";

const CALLER_SECRET = "test-caller-secret-0123456789abcdef";

test("control health preserves the safe UI contract without returning capability data", async () => {
  const requests = [];
  const result = await readControlHealth({
    routerPort: 43210,
    readCallerSecret: () => `${CALLER_SECRET}\n`,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          service: "codex-router",
          version: "test-version",
          router: "ready",
          degraded: ["gateway"],
          activity: { state: "generating", activeCount: 1, active: [{ model: "test/model" }] },
          gateway: { reachable: false, enabled: true, credential: CALLER_SECRET },
          oauth: { reachable: true, session: CALLER_SECRET },
          api: { reachable: true },
          grokOauth: { reachable: true, enabled: false },
          credential: CALLER_SECRET,
          callerUrl: `http://127.0.0.1:43210/${CALLER_SECRET}`,
        }),
      };
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `http://127.0.0.1:43210/_codex-router/${CALLER_SECRET}/v1/health`);
  assert.deepEqual(requests[0].options.headers, { Accept: "application/json" });
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.deepEqual(result, {
    ok: true,
    status: 200,
    service: "codex-router",
    version: "test-version",
    router: "ready",
    degraded: ["gateway"],
    activity: { state: "generating", activeCount: 1, active: [{ model: "test/model" }] },
    gateway: { reachable: false, enabled: true },
    oauth: { reachable: true },
    api: { reachable: true },
    grokOauth: { reachable: true, enabled: false },
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(CALLER_SECRET));
});

test("control health fails closed before fetch when the caller capability is unavailable", async () => {
  let fetches = 0;
  const result = await readControlHealth({
    readCallerSecret: () => "invalid",
    fetchImpl: async () => {
      fetches += 1;
      throw new Error("fetch must not run");
    },
  });

  assert.equal(fetches, 0);
  assert.deepEqual(result, {
    ok: false,
    status: 0,
    error: "The local router caller key is unavailable.",
    activity: { state: "offline", active: [], activeCount: 0 },
  });
});

test("control health preserves unreachable and timeout projections", async () => {
  const unreachable = await readControlHealth({
    readCallerSecret: () => CALLER_SECRET,
    fetchImpl: async () => { throw new Error("planned transport failure"); },
  });
  const timeout = await readControlHealth({
    readCallerSecret: () => CALLER_SECRET,
    fetchImpl: async () => { throw Object.assign(new Error("planned timeout"), { name: "TimeoutError" }); },
  });

  assert.equal(unreachable.error, "Router is unreachable.");
  assert.equal(timeout.error, "Health check timed out.");
  assert.deepEqual(unreachable.activity, { state: "offline", active: [], activeCount: 0 });
  assert.deepEqual(timeout.activity, { state: "offline", active: [], activeCount: 0 });
});

// The router answers a `/health` cache miss only after aborting its own 3s probe
// of each downstream service, so a client budget equal to that probe loses every
// photo finish: a wedged gateway -- TCP accepted, no reply -- painted the whole
// router as offline instead of naming the one dependency that was down. This
// measures the *default* budget against that probe, and it is the only test that
// fails if the two are ever made equal again.
test("control health waits out the router's own probe before calling it offline", async () => {
  const started = Date.now();
  const result = await readControlHealth({
    readCallerSecret: () => CALLER_SECRET,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
      });
    }),
  });
  const elapsed = Date.now() - started;

  assert.equal(result.error, "Health check timed out.");
  assert.ok(
    elapsed > 3_500,
    `DEFAULT_HEALTH_TIMEOUT_MS (${DEFAULT_HEALTH_TIMEOUT_MS}ms) must outlast the router's 3s probe; `
      + `it gave up after ${elapsed}ms`,
  );
  assert.ok(elapsed < 15_000, `the default budget must stay bounded; it ran ${elapsed}ms`);
});
