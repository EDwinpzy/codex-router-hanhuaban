#!/usr/bin/env node
// The scheduled task already supervises a *dead* router: a one-minute
// heartbeat with `MultipleInstances IgnoreNew` relaunches it whenever the
// process is gone (see installTask() in service-windows.mjs). What that
// heartbeat cannot see is a *hung* router -- one whose TCP listener still
// accepts, so Task Scheduler counts the instance as live, while its event
// loop never answers HTTP. That is the 2026-09-18 failure: the Control Center
// painted "offline / Health check timed out" for minutes while
// `service.mjs status` still reported `running` and every port still showed
// LISTENING.
//
// This watchdog closes exactly that gap and nothing else. It ends a process
// tree that is listening but mute, then lets the existing heartbeat perform
// the restart. It deliberately does not call `stop` (that disables the task
// and would silence the heartbeat, permanently) and does not call
// `service.mjs restart` (that additionally waits out a 300-second readiness
// budget, which a scheduled tick cannot afford).
//
// Every state other than "mute listener" is left alone:
//   healthy    -- nothing to do
//   unhealthy  -- the router answered; a degraded downstream is the
//                 gateway supervisor's business, and restarting a cold-starting
//                 router that briefly serves 503 would only make it slower
//   refused    -- nothing is listening, so the service is simply not running.
//                 The heartbeat owns that case, and a deliberate `stop` (which
//                 disables the task) must not be undone here
//
// Usage:
//   node src/health-watchdog.mjs            one check; heals only if hung
//   node src/health-watchdog.mjs --status   report only, never mutates
//   node src/health-watchdog.mjs --json     machine-readable result

import net from "node:net";
import path from "node:path";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { PORTS, SOURCE_ROOT, STATE_DIR } from "./paths.mjs";
import { withServiceOperationLock } from "./service-operation-lock.mjs";

// Deliberately above the Control Center's 6s ceiling, because this one has to
// clear the router's own worst case rather than a UI's patience. That worst
// case is measurable: a cold start serves /health by probing every downstream
// service and was clocked at ~11.1s once (2026-09-18), returning 503 rather
// than hanging. A ceiling below that would abort a legitimate answer, and two
// aborted probes would then read as a hang -- restarting a router that was
// still booting, which is the one outcome this watchdog must never cause.
const PROBE_TIMEOUT_MS = 15_000;
// A cold start serves /health from a live probe of every downstream service
// and was measured at ~11s once (2026-09-18). Requiring two consecutive mute
// probes, separated by a real gap, keeps that legitimate slowness from being
// read as a hang: the second probe lands past the cold-start window.
const PROBE_ATTEMPTS = 2;
const RETRY_DELAY_MS = 4_000;
const CONNECT_TIMEOUT_MS = 3_000;
// Re-healing more often than this cannot help -- a router that hangs again
// within the cooldown is a different problem than the one this watchdog is
// allowed to solve, and an unthrottled loop would restart it forever.
const COOLDOWN_MS = 5 * 60_000;
const PLATFORM_COMMAND_TIMEOUT_MS = 90_000;

const PLATFORM_SCRIPTS = {
  darwin: "service-macos.mjs",
  linux: "service-linux.mjs",
  win32: "service-windows.mjs",
};

const LOG_PATH = path.join(STATE_DIR, "health-watchdog.log");
const STATE_PATH = path.join(STATE_DIR, "health-watchdog.json");

// The installed Windows wrapper sets the router's own QUIET convention and
// appends this process's stdout to a log file. Honouring it is what keeps a
// healthy tick -- roughly 720 a day -- from writing a line every time.
const QUIET =
  process.env.MODEL_ROUTER_QUIET === "1" || process.env.CODEX_ROUTER_QUIET === "1";

function log(line) {
  try {
    mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
    appendFileSync(LOG_PATH, `[health-watchdog] ${new Date().toISOString()} ${line}\n`);
  } catch {
    // A watchdog that cannot write its own log still has to work.
  }
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Overwritten in place, never appended: the per-tick probe record is a
// heartbeat, and a file that grows on every healthy tick would be its own
// maintenance burden.
function writeState(patch) {
  try {
    mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(
      STATE_PATH,
      `${JSON.stringify({ version: 1, ...readState(), ...patch }, null, 2)}\n`,
      { mode: 0o600 },
    );
  } catch {
    // Best effort: a lost timestamp costs one extra restart, not correctness.
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// No caller key is used: `/health` answers an unauthenticated probe, so the
// watchdog never has to read a credential to decide whether to act.
function probeHealth() {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    fetch(`http://127.0.0.1:${PORTS.router}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(timer);
        resolve(response.ok ? "healthy" : "unhealthy");
      })
      .catch((error) => {
        clearTimeout(timer);
        const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
        resolve(timedOut ? "mute" : "refused");
      });
  });
}

// A hung router still completes the TCP handshake -- that is precisely what
// keeps Task Scheduler satisfied -- so a successful connect is the signature
// that separates "listening but mute" from "not running at all".
function portIsListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const settle = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

async function inspect() {
  let verdict = "healthy";
  for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt += 1) {
    verdict = await probeHealth();
    if (verdict !== "mute") return { verdict, attempts: attempt };
    if (attempt < PROBE_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  return { verdict, attempts: PROBE_ATTEMPTS };
}

function restartServiceTree() {
  const script = PLATFORM_SCRIPTS[process.platform];
  if (!script) return { ok: false, detail: `unsupported platform ${process.platform}` };
  const result = spawnSync(
    process.execPath,
    [path.join(SOURCE_ROOT, "src", script), "restart"],
    {
      encoding: "utf8",
      timeout: PLATFORM_COMMAND_TIMEOUT_MS,
      // The action ends the running tree and re-runs the task. `restart` also
      // re-enables the task, so a watchdog heal can never leave it disabled.
      windowsHide: true,
    },
  );
  if (result.error) return { ok: false, detail: String(result.error.message || result.error) };
  if (result.status !== 0) {
    const stderr = String(result.stderr || "").trim().split("\n").pop() || "";
    return { ok: false, detail: `exit ${result.status}${stderr ? `: ${stderr}` : ""}` };
  }
  return { ok: true, detail: "restart accepted" };
}

async function healUnderLock() {
  try {
    // Never wait: if the user (or the Control Center, or an installer) is
    // already mutating the service, that operation is the better one to let
    // finish, and this tick can simply report and try again in a minute.
    return await withServiceOperationLock(() => restartServiceTree(), { waitMs: 500 });
  } catch (error) {
    return { ok: false, busy: true, detail: error?.message || String(error) };
  }
}

function report(outcome, asJson, force = false) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`);
    return;
  }
  // Under QUIET only a real action is worth a line. `force` carries the
  // explicit --status mode: an operator asking a direct question always gets
  // an answer, even from the quiet installed copy.
  if (QUIET && !force && outcome.action === "none") return;
  const listening = outcome.listening === undefined ? "-" : String(outcome.listening);
  process.stdout.write(
    `probe=${outcome.verdict} attempts=${outcome.attempts} listening=${listening} ` +
      `action=${outcome.action}\n`,
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const reportOnly = args.has("--status");
  const asJson = args.has("--json");

  const probe = await inspect();
  const outcome = {
    verdict: probe.verdict,
    attempts: probe.attempts,
    listening: undefined,
    action: "none",
  };

  if (probe.verdict !== "mute") {
    // A healthy tick is the overwhelmingly common case (~720 a day). Logging
    // each one would grow the file forever without ever saying anything new,
    // so only departures from healthy leave a durable line. The probe record
    // lives in the overwritten state file instead.
    if (probe.verdict !== "healthy") {
      log(`probe=${probe.verdict} attempts=${probe.attempts} action=none`);
    }
    writeState({ lastProbeAt: Date.now(), lastVerdict: probe.verdict });
    report(outcome, asJson, reportOnly);
    return 0;
  }

  outcome.listening = await portIsListening(PORTS.router);
  if (!outcome.listening) {
    log(`probe=mute attempts=${probe.attempts} listening=false action=none (service not running)`);
    report(outcome, asJson, reportOnly);
    return 0;
  }

  outcome.verdict = "hung";

  if (reportOnly) {
    outcome.action = "reported";
    log("probe=hung listening=true action=reported (--status)");
    report(outcome, asJson, reportOnly);
    return 0;
  }

  const lastRestartAt = readState().lastRestartAt;
  if (Number.isSafeInteger(lastRestartAt) && Date.now() - lastRestartAt < COOLDOWN_MS) {
    outcome.action = "skipped-cooldown";
    outcome.lastRestartAt = lastRestartAt;
    log(`probe=hung listening=true action=skipped-cooldown lastRestartAt=${lastRestartAt}`);
    report(outcome, asJson, reportOnly);
    return 0;
  }

  const healed = await healUnderLock();
  outcome.action = healed.ok ? "restarted" : healed.busy ? "skipped-busy" : "restart-failed";
  outcome.detail = healed.detail;
  if (healed.ok) {
    outcome.lastRestartAt = Date.now();
    writeState({ lastRestartAt: outcome.lastRestartAt });
  }
  log(
    `probe=hung listening=true action=${outcome.action} detail=${JSON.stringify(healed.detail)}`,
  );
  report(outcome, asJson, reportOnly);
  return healed.ok || healed.busy ? 0 : 1;
}

process.exit(await main());
