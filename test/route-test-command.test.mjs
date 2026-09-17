import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  return spawnSync(process.execPath, [path.join(root, "src", "control.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  });
}

// The Models page's per-account Test button reaches this one subcommand. Its
// contract is the same as every other live workflow in this repository: a
// request that bills somebody is never sent without both an explicit live
// intent and an explicit consent flag, and the refusal happens before any
// provider is asked.
test("a live route test refuses to spend quota without both consent flags", () => {
  const missing = run(["test-route", "deepseek/deepseek-v4-flash"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /quota.*--live --yes/i);

  const partial = run(["test-route", "deepseek/deepseek-v4-flash", "--live"]);
  assert.notEqual(partial.status, 0);
  assert.match(partial.stderr, /quota.*--live --yes/i);
});

test("a live route test refuses an option it does not implement", () => {
  const unknown = run(["test-route", "deepseek/deepseek-v4-flash", "--live", "--yes", "--provision"]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown route test option: --provision/);
});
