import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { openPort } from "./port-pool.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const internalKey = "test-anthropic-tool-entries-internal-key";
const providerKey = "test-anthropic-provider-key";
// The one Anthropic-protocol model the checked-in registry carries; the
// forwarder keys its whole Anthropic tool repair off `provider.protocol`.
const gatewayModel = "anthropic-api-claude-opus-4-8";

// Stands in for api.anthropic.com. It answers the Messages shape and records
// what the forwarder actually sent, which is the only place the repaired tool
// array is observable.
function mockAnthropic() {
  const calls = [];
  const server = http.createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      calls.push({ url: request.url, headers: request.headers, body: JSON.parse(raw) });
      const payload = JSON.stringify({
        id: "msg_tool_entries",
        type: "message",
        role: "assistant",
        model: "claude-opus-4-8",
        content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 4, output_tokens: 1 },
      });
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(payload)),
      });
      response.end(payload);
    });
  });
  return { server, calls };
}

async function listen(server, port) {
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
}

async function waitForHealth(base, headers, child, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`forwarder exited: ${output()}`);
    try {
      const health = await fetch(`${base}/health`, { headers });
      if (health.ok) return;
    } catch {
      // The forwarder is still binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`forwarder never became healthy: ${output()}`);
}

async function startForwarder() {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "anthropic-tool-entries-state-"));
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(stateDir, "anthropic-api-key.secret"), `${providerKey}\n`, {
    mode: 0o600,
  });
  writeFileSync(
    path.join(stateDir, "enabled-providers.json"),
    `${JSON.stringify({ version: 1, providers: ["anthropic-api"] })}\n`,
    { mode: 0o600 },
  );

  const upstreamPort = await openPort();
  const forwarderPort = await openPort();
  const { server, calls } = mockAnthropic();
  await listen(server, upstreamPort);

  const child = spawn(process.execPath, [path.join(root, "src", "api-forwarder.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      MODEL_ROUTER_TARGET: "codex",
      MODEL_ROUTER_INTERNAL_KEY: internalKey,
      MODEL_ROUTER_API_PORT: String(forwarderPort),
      MODEL_ROUTER_STATE_DIR: stateDir,
      MODEL_ROUTER_QUIET: "1",
      ANTHROPIC_API_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const base = `http://127.0.0.1:${forwarderPort}`;
  const headers = { Authorization: `Bearer ${internalKey}`, "Content-Type": "application/json" };
  await waitForHealth(base, headers, child, () => stderr);
  return {
    base,
    headers,
    calls,
    stderr: () => stderr,
    async stop() {
      if (child.exitCode === null) child.kill("SIGTERM");
      await new Promise((resolve) => server.close(resolve));
      rmSync(stateDir, { recursive: true, force: true });
    },
  };
}

test("an Anthropic tool entry with no schema keeps its name and gains an empty root", async () => {
  const stack = await startForwarder();
  try {
    const response = await fetch(`${stack.base}/v1/messages`, {
      method: "POST",
      headers: stack.headers,
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
        tools: [
          { name: "exec_command", input_schema: { type: "object", properties: {} } },
          // LiteLLM's shape for a hosted/control tool: a name, no schema.
          { type: "code_execution_20250522", name: "code_execution" },
        ],
      }),
    });
    assert.equal(response.status, 200, stack.stderr());
    assert.equal(stack.calls.length, 1);
    const sent = stack.calls[0].body.tools;
    assert.equal(sent.length, 2);
    // A schema the caller already sent is untouched, by identity.
    assert.deepEqual(sent[0], {
      name: "exec_command",
      input_schema: { type: "object", properties: {} },
    });
    assert.deepEqual(sent[1], {
      type: "code_execution_20250522",
      name: "code_execution",
      input_schema: { type: "object", properties: {} },
    });
    assert.match(stack.stderr(), /anthropic tool entries repaired=1 dropped=0/);
  } finally {
    await stack.stop();
  }
});

// The measured regression: Codex declares its standalone hosted search tool
// with the versioned spelling and puts it last, so the entry LiteLLM could not
// schema arrived at the end of the array and took the whole turn with it.
test("Codex's last hosted search entry reaches the provider with a schema", async () => {
  const stack = await startForwarder();
  try {
    const response = await fetch(`${stack.base}/v1/messages`, {
      method: "POST",
      headers: stack.headers,
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
        tools: [
          { type: "custom", name: "exec_command", input_schema: { type: "object", properties: {} } },
          { type: "web_search_20250305", name: "web_search" },
        ],
      }),
    });
    assert.equal(response.status, 200, stack.stderr());
    const sent = stack.calls[0].body.tools;
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[1], {
      type: "web_search_20250305",
      name: "web_search",
      input_schema: { type: "object", properties: {} },
    });
    assert.match(stack.stderr(), /anthropic tool entries repaired=1 dropped=0/);
  } finally {
    await stack.stop();
  }
});

test("an Anthropic tool entry with no usable name is dropped", async () => {
  const stack = await startForwarder();
  try {
    const response = await fetch(`${stack.base}/v1/messages`, {
      method: "POST",
      headers: stack.headers,
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
        tools: [
          { name: "exec_command", input_schema: { type: "object", properties: {} } },
          { type: "code_execution_20250522" },
          { type: "advisor_20260301", name: "   " },
          "not-an-object",
        ],
      }),
    });
    assert.equal(response.status, 200, stack.stderr());
    assert.deepEqual(stack.calls[0].body.tools, [
      { name: "exec_command", input_schema: { type: "object", properties: {} } },
    ]);
    assert.match(stack.stderr(), /anthropic tool entries repaired=0 dropped=3/);
  } finally {
    await stack.stop();
  }
});

test("a tool list the provider can already read is forwarded unchanged", async () => {
  const stack = await startForwarder();
  try {
    const tools = [{ name: "exec_command", input_schema: { type: "object", properties: {} } }];
    const response = await fetch(`${stack.base}/v1/messages`, {
      method: "POST",
      headers: stack.headers,
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
        tools,
      }),
    });
    assert.equal(response.status, 200, stack.stderr());
    assert.deepEqual(stack.calls[0].body.tools, tools);
    assert.doesNotMatch(stack.stderr(), /anthropic tool entries/);
  } finally {
    await stack.stop();
  }
});

test("a tool list this repair empties is sent without a tools field", async () => {
  const stack = await startForwarder();
  try {
    const response = await fetch(`${stack.base}/v1/messages`, {
      method: "POST",
      headers: stack.headers,
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
        tools: [{ type: "code_execution_20250522" }],
        tool_choice: { type: "auto" },
      }),
    });
    assert.equal(response.status, 200, stack.stderr());
    assert.equal("tools" in stack.calls[0].body, false);
    assert.equal("tool_choice" in stack.calls[0].body, false);
    assert.match(stack.stderr(), /anthropic tool entries repaired=0 dropped=1/);
  } finally {
    await stack.stop();
  }
});
