// What a provider's monthly credit pool started out holding.
//
// Command Code's billing endpoint reports the monthly pool as a *remaining*
// amount: `credits.monthlyCredits` is what is left, and the payload carries no
// monthly cap, no monthly `used`, and no reset time for it. A percentage
// therefore cannot be read off the response the way opencode's windows allow.
//
// The total is derivable from the pool's own behaviour -- it only falls while a
// cycle runs, and jumps back up when the plan refills it -- so this module
// remembers the reading and the total each provider's cycle opened with.
// `limit = used + remaining` then holds by construction: the remembered total is
// what the cycle began with, `used` is what has left the pool since, and the
// difference is the number the endpoint just reported.
//
// A provider seen for the first time has no earlier reading to compare against,
// so its first cycle opens looking unspent and corrects itself at the first
// refill. That is the honest failure: the alternative is a hardcoded plan
// amount, which goes stale the moment the provider ships a different one.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { writePrivateJson } from "./file-security.mjs";
import { STATE_DIR } from "./paths.mjs";

// Resolved per call so a test (or an operator) can point the bookkeeping at a
// scratch file without reloading this module.
function cyclesPath() {
  return (
    process.env.MODEL_ROUTER_CREDIT_CYCLES ||
    path.join(STATE_DIR, "provider-credit-cycles.json")
  );
}

const MAX_CYCLE_ENTRIES = 64;

function readDocument() {
  const target = cyclesPath();
  if (!existsSync(target)) return {};
  try {
    const parsed = JSON.parse(readFileSync(target, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Losing this costs one cycle of accuracy and never a turn.
    return {};
  }
}

function writeDocument(document) {
  try {
    const entries = Object.entries(document)
      .sort((left, right) => String(right[1]?.observedAt).localeCompare(String(left[1]?.observedAt)))
      .slice(0, MAX_CYCLE_ENTRIES);
    writePrivateJson(cyclesPath(), Object.fromEntries(entries), { directoryMode: 0o700 });
  } catch {
    // Quota reporting must never fail because its own bookkeeping could not
    // be saved.
  }
}

export function readCreditCycle(providerId) {
  const entry = readDocument()[providerId];
  if (!entry || typeof entry !== "object") return undefined;
  const grant = Number(entry.grant);
  const pool = Number(entry.pool);
  return {
    ...(Number.isFinite(grant) && grant > 0 ? { grant } : {}),
    ...(Number.isFinite(pool) && pool >= 0 ? { pool } : {}),
    ...(typeof entry.observedAt === "string" ? { observedAt: entry.observedAt } : {}),
  };
}

/**
 * Record `pool` and answer with the total its current cycle is working against.
 *
 * A pool that grew since the previous reading means the provider refilled it:
 * that is a new cycle, or a plan change, so the new reading is the total. A
 * pool that only shrank keeps the total its cycle started with. `document` is
 * for tests that want the decision without touching disk.
 */
export function observeCreditPool(providerId, pool, { at = new Date(), document } = {}) {
  const value = Number(pool);
  if (!Number.isFinite(value) || value < 0) return undefined;
  const current = document ?? readDocument();
  const previous = current[providerId] && typeof current[providerId] === "object"
    ? current[providerId]
    : {};
  const previousPool = Number(previous.pool);
  const previousGrant = Number(previous.grant);
  let grant = Number.isFinite(previousGrant) && previousGrant > 0 ? previousGrant : value;
  if (Number.isFinite(previousPool) && value > previousPool) grant = value;
  if (value > grant) grant = value;
  const next = {
    ...current,
    [providerId]: {
      grant,
      pool: value,
      observedAt: new Date(at).toISOString(),
    },
  };
  if (document === undefined) writeDocument(next);
  return grant;
}
