import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { observeCreditPool, readCreditCycle } from "../src/provider-credit-cycles.mjs";

function scratchFile() {
  const file = path.join(os.tmpdir(), `credit-cycles-${process.pid}-${Date.now()}-${Math.random()}.json`);
  process.env.MODEL_ROUTER_CREDIT_CYCLES = file;
  return file;
}

test("a pool seen for the first time opens its cycle at what it reports", () => {
  assert.equal(observeCreditPool("commandcode", 34.5, { document: {}, at: 0 }), 34.5);
});

test("a pool that only falls keeps the total its cycle opened with", () => {
  const document = { commandcode: { grant: 70, pool: 34.5, observedAt: "2026-09-18T00:00:00.000Z" } };
  assert.equal(observeCreditPool("commandcode", 34, { document, at: 0 }), 70);
  assert.equal(observeCreditPool("commandcode", 0, { document, at: 0 }), 70);
});

// A refill is the only moment the month's total is visible, and it is also how
// a plan change shows up: a smaller refill than last month's total is the new
// total, not a rounding error against the old one.
test("a pool that grows is a new cycle at the value it grew to", () => {
  const previous = { commandcode: { grant: 70, pool: 0.4, observedAt: "2026-09-18T00:00:00.000Z" } };
  assert.equal(observeCreditPool("commandcode", 70, { document: previous, at: 0 }), 70);
  assert.equal(observeCreditPool("commandcode", 35, { document: previous, at: 0 }), 35);
});

test("the cycle total survives a restart in a private state file", () => {
  const file = scratchFile();
  try {
    assert.equal(readCreditCycle("commandcode"), undefined);
    observeCreditPool("commandcode", 70, { at: "2026-09-01T00:00:00.000Z" });
    observeCreditPool("commandcode", 34.999522866, { at: "2026-09-18T00:00:00.000Z" });
    assert.deepEqual(readCreditCycle("commandcode"), {
      grant: 70,
      pool: 34.999522866,
      observedAt: "2026-09-18T00:00:00.000Z",
    });
    // A later reading still measures against the cycle it belongs to.
    assert.equal(observeCreditPool("commandcode", 34.5), 70);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).commandcode.grant, 70);
  } finally {
    delete process.env.MODEL_ROUTER_CREDIT_CYCLES;
    rmSync(file, { force: true });
  }
});

test("an unreadable cycle document costs accuracy, not an answer", async () => {
  const file = scratchFile();
  try {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, "{ not json");
    assert.equal(readCreditCycle("commandcode"), undefined);
    assert.equal(observeCreditPool("commandcode", 12, { at: 0 }), 12);
  } finally {
    delete process.env.MODEL_ROUTER_CREDIT_CYCLES;
    rmSync(file, { force: true });
  }
});

test("a pool that is not a number is refused rather than guessed at", () => {
  assert.equal(observeCreditPool("commandcode", Number.NaN, { document: {} }), undefined);
  assert.equal(observeCreditPool("commandcode", -1, { document: {} }), undefined);
  assert.equal(observeCreditPool("commandcode", undefined, { document: {} }), undefined);
});
