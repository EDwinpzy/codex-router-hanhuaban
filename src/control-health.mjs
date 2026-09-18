import { readFileSync } from "node:fs";

import { assertCallerSecret, callerBaseUrl } from "./caller-auth.mjs";
import { CALLER_SECRET_PATH, PORTS } from "./paths.mjs";

const OFFLINE_ACTIVITY = Object.freeze({ state: "offline", active: [], activeCount: 0 });

// The router serves `/health` from a 3s cache, but a cache miss falls through to
// a live probe of each downstream service, and `probeService` aborts that probe
// at 3_000ms (src/router.mjs). This client budget therefore has to sit strictly
// *above* the router's own worst case, not equal to it: when both were 3_000ms
// the client lost every photo finish, because the router still had to serialise
// and send the body after its probe finally resolved. A hung gateway -- TCP
// accepted, no reply, which is what a wedged LiteLLM/uvicorn looks like -- then
// painted the entire router as "offline" instead of naming the single
// dependency that was down, and the tray kept reporting a healthy router as
// dead until the gateway recovered.
//
// Deliberately generous: a healthy router answers this endpoint in ~2ms, so the
// ceiling only ever applies on the failure path, where the router's own probe
// abort still returns the real answer (~3s) long before it. The panel guards its
// poll with an in-flight flag, so a larger budget cannot pile requests up.
export const DEFAULT_HEALTH_TIMEOUT_MS = 6_000;

function offlineHealth(error) {
  return {
    ok: false,
    status: 0,
    error,
    activity: { ...OFFLINE_ACTIVITY },
  };
}

function safeService(service) {
  if (!service || typeof service !== "object") return undefined;
  return {
    reachable: service.reachable === true,
    ...(typeof service.enabled === "boolean" ? { enabled: service.enabled } : {}),
  };
}

// Read the protected health leaf and project it to the stable, credential-free
// contract shared by the CLI, tray, and Electron Control Center. Callers may
// provide fetch/read seams for deterministic tests; production keeps the
// capability and its URL inside the trusted Node/Electron main process.
export async function readControlHealth({
  fetchImpl = globalThis.fetch,
  readCallerSecret = () => readFileSync(CALLER_SECRET_PATH, "utf8"),
  routerPort = PORTS.router,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
} = {}) {
  let callerSecret;
  try {
    callerSecret = assertCallerSecret(readCallerSecret().trim());
  } catch {
    return offlineHealth("The local router caller key is unavailable.");
  }

  try {
    const response = await fetchImpl(`${callerBaseUrl(routerPort, callerSecret)}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await response.json().catch(() => ({}));
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      ok: response.ok,
      status: response.status,
      ...(typeof body.service === "string" ? { service: body.service } : {}),
      ...(typeof body.version === "string" ? { version: body.version } : {}),
      ...(typeof body.router === "string" ? { router: body.router } : {}),
      ...(Array.isArray(body.degraded) ? { degraded: body.degraded } : {}),
      ...(body.activity && typeof body.activity === "object" ? { activity: body.activity } : {}),
      ...(safeService(body.gateway) ? { gateway: safeService(body.gateway) } : {}),
      ...(safeService(body.oauth) ? { oauth: safeService(body.oauth) } : {}),
      ...(safeService(body.api) ? { api: safeService(body.api) } : {}),
      ...(safeService(body.grokOauth) ? { grokOauth: safeService(body.grokOauth) } : {}),
    };
  } catch (error) {
    const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
    return offlineHealth(timedOut ? "Health check timed out." : "Router is unreachable.");
  }
}
