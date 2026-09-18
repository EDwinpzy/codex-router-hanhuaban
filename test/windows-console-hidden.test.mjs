import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Every probe asserted here runs inside a process that owns no console: the
// Windows service starts under `wscript.exe //B`, the tray and the Control
// Center are GUI binaries, and both reach the router through a
// CREATE_NO_WINDOW child. A console application started from one of those
// allocates a brand new console window, which Windows Terminal then draws on
// screen for as long as the probe lives -- so an unhidden `ollama list` opened
// a terminal the operator watched appear and vanish on every tray poll.
//
// `windowsHide` is what passes CREATE_NO_WINDOW down, and it is easy to leave
// off one call site without noticing. Each case below drives the real exported
// function and reads the options it handed to an injected spawn, so a dropped
// flag fails here instead of showing up as a window on somebody's screen.

const stateDir = mkdtempSync(path.join(os.tmpdir(), "console-hidden-test-"));
process.env.CODEX_ROUTER_STATE_DIR = stateDir;

const {
  localModelCapabilities,
  localModelInventory,
  removeLocalModel,
  runningLocalModels,
} = await import("../src/local-models.mjs");
const {
  localOllamaRuntimeSnapshot,
  ollamaCommand,
  ollamaUpdatePlan,
  ollamaVersion,
} = await import("../src/ollama-runtime.mjs");
const { ollamaInstalledModels, pullOllamaModel } = await import("../src/vision-host.mjs");
const { removeLocalModelFromDisk } = await import("../src/local-uninstall.mjs");

// A successful, empty answer keeps every caller on its happy path while still
// recording the options it passed.
function recorder() {
  const calls = [];
  function spawn(command, args, options) {
    calls.push({ command, args, options: options || {} });
    return { status: 0, stdout: "", stderr: "" };
  }
  return { spawn, calls };
}

function assertEveryCallHides(spawn, label, { atLeast = 1 } = {}) {
  assert.ok(
    spawn.calls.length >= atLeast,
    `${label}: expected at least ${atLeast} child-process call(s), saw ${spawn.calls.length}`,
  );
  for (const call of spawn.calls) {
    assert.equal(
      call.options.windowsHide,
      true,
      `${label}: \`${call.command} ${(call.args || []).join(" ")}\` must pass windowsHide: true`,
    );
  }
}

test("every ollama probe hides its console window", () => {
  const inventory = recorder();
  localModelInventory({ spawn: inventory.spawn });
  assertEveryCallHides(inventory, "localModelInventory");

  const running = recorder();
  runningLocalModels({ spawn: running.spawn });
  assertEveryCallHides(running, "runningLocalModels");

  const capabilities = recorder();
  localModelCapabilities("gemma3:4b", "abc123", { spawn: capabilities.spawn, cache: {} });
  assertEveryCallHides(capabilities, "localModelCapabilities");

  const removal = recorder();
  removeLocalModel("doomed:latest", {
    spawn: removal.spawn,
    confirmed: true,
    capabilitiesFor: () => ["completion"],
  });
  assertEveryCallHides(removal, "removeLocalModel");

  const diskRemoval = recorder();
  removeLocalModelFromDisk("doomed:latest", { spawn: diskRemoval.spawn, command: "ollama" });
  assertEveryCallHides(diskRemoval, "removeLocalModelFromDisk");
});

test("every ollama runtime probe hides its console window", () => {
  const version = recorder();
  ollamaCommand({ spawn: version.spawn });
  assertEveryCallHides(version, "ollamaCommand");

  const explicitVersion = recorder();
  ollamaVersion({ command: "ollama", spawn: explicitVersion.spawn });
  assertEveryCallHides(explicitVersion, "ollamaVersion");

  const snapshot = recorder();
  localOllamaRuntimeSnapshot({ spawn: snapshot.spawn });
  assertEveryCallHides(snapshot, "localOllamaRuntimeSnapshot", { atLeast: 2 });
});

test("the winget probe hides its console window", () => {
  const plan = recorder();
  // The platform is named rather than read so the winget branch is covered on
  // every host that runs this suite.
  ollamaUpdatePlan({ spawn: plan.spawn, platform: "win32" });
  const wingetCalls = plan.calls.filter((call) => call.command === "winget");
  assert.ok(wingetCalls.length >= 2, "expected `winget --version` and a winget list probe");
  assertEveryCallHides(plan, "ollamaUpdatePlan", { atLeast: 2 });
});

test("the vision bridge hides the console window of the probes it runs", () => {
  const installed = recorder();
  ollamaInstalledModels({ spawn: installed.spawn });
  assertEveryCallHides(installed, "ollamaInstalledModels");

  const pull = recorder();
  pullOllamaModel("qwen2.5vl:3b", { spawn: pull.spawn });
  assertEveryCallHides(pull, "pullOllamaModel");
});
