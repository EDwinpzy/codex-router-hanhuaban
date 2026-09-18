// The last reading an account's own usage API returned, kept so a transient
// upstream failure does not blank the card.
//
// opencode's usage route is why this exists. It is served by their own
// aggregation backend rather than by the inference edge, and it refuses in
// bursts of minutes: `GET https://opencode.ai/usage` answered
// `503 {"type":"error","error":{"type":"api_error","message":"Go usage is
// unavailable"}}` on ten of twelve consecutive probes during one measured
// burst, while seven of eight succeeded a few minutes later on the same key
// and the same session. A failed refresh therefore says nothing about whether
// the plan is measurable -- only that this read landed inside a burst -- and
// throwing the previous reading away makes a two-minute fault look like a
// broken connection.
//
// What is remembered is a *reading of a window*, not a number standing alone.
// Every quota metric carries the reset time of the window it describes, so a
// remembered reading is served only while that window is still open: once the
// window resets, the remembered percentage describes a window that no longer
// exists and is dropped rather than shown. A window that is still open can
// only have accumulated more usage since it was read, so what a caller shows
// from here is a lower bound on consumption -- never overstated headroom.
//
// Callers must not render a remembered reading as a current one. `available`
// means this refresh read the account; a reading from here is returned under
// the `stale` status with the instant it was taken, and a surface that cannot
// state that must not show it at all.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { writePrivateJson } from "./file-security.mjs";
import { STATE_DIR } from "./paths.mjs";

// Resolved per call so a test (or an operator) can point the memory at a
// scratch file without reloading this module.
function cachePath() {
  return (
    process.env.MODEL_ROUTER_USAGE_CACHE ||
    path.join(STATE_DIR, "provider-usage-cache.json")
  );
}

const MAX_CACHED_PROVIDERS = 64;

function readDocument() {
  const target = cachePath();
  if (!existsSync(target)) return {};
  try {
    const parsed = JSON.parse(readFileSync(target, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Losing this costs one refresh of continuity and never a turn.
    return {};
  }
}

function writeDocument(document) {
  try {
    const entries = Object.entries(document)
      .sort((left, right) => String(right[1]?.observedAt).localeCompare(String(left[1]?.observedAt)))
      .slice(0, MAX_CACHED_PROVIDERS);
    writePrivateJson(cachePath(), Object.fromEntries(entries), { directoryMode: 0o700 });
  } catch {
    // Quota reporting must never fail because its own memory could not be
    // saved. The reading is a convenience; the API call is the source.
  }
}

/**
 * The last reading of this provider's currently open windows, or undefined.
 *
 * A metric with no reset time makes no claim about which window it describes,
 * so it cannot be shown as still valid and is dropped with the same weight as
 * one whose window has already closed.
 */
export function readCachedUsage(providerId, { now = Date.now() } = {}) {
  const entry = readDocument()[providerId];
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.metrics)) return undefined;
  const nowSeconds = now / 1_000;
  const metrics = entry.metrics.filter((metric) => {
    if (!metric || typeof metric !== "object") return false;
    const resetAt = Number(metric.resetAt);
    return Number.isFinite(resetAt) && resetAt > nowSeconds;
  });
  if (!metrics.length) return undefined;
  return {
    metrics,
    ...(typeof entry.observedAt === "string" ? { observedAt: entry.observedAt } : {}),
    ...(typeof entry.dashboardUrl === "string" && entry.dashboardUrl
      ? { dashboardUrl: entry.dashboardUrl }
      : {}),
  };
}

/**
 * Record a successful reading. A reading with no metrics is not a reading:
 * an empty report must never be able to overwrite a usable one and turn the
 * next outage into "usage unavailable" instead of the last known windows.
 */
export function rememberUsage(providerId, { metrics, dashboardUrl } = {}, { at = new Date() } = {}) {
  const kept = Array.isArray(metrics)
    ? metrics.filter((metric) => metric && typeof metric === "object")
    : [];
  if (!kept.length) return;
  writeDocument({
    ...readDocument(),
    [providerId]: {
      metrics: kept,
      observedAt: new Date(at).toISOString(),
      ...(typeof dashboardUrl === "string" && dashboardUrl ? { dashboardUrl } : {}),
    },
  });
}
