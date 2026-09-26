import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const asset = readFileSync(
  new URL(
    "../scratch/asar/webview/assets/app-initial-236e1501144c.js",
    import.meta.url,
  ),
  "utf8",
);
const start = asset.indexOf("        prewarmConversation(e, t) {");
const end = asset.indexOf("        async createConversation(", start);
assert.ok(
  start >= 0 && end > start,
  "prewarm entry point exists in prepared renderer",
);

function fixture(window) {
  const calls = { inputs: 0, disposed: 0, requests: 0, stored: 0 };
  const create = new Function(
    "window",
    "gdn",
    "Zx",
    "Gg",
    "T2t",
    "hS",
    `return ({${asset.slice(start, end)}})`,
  );
  const controller = create(
    window,
    class {
      async preparePrewarm() {
        return { start: { request: { cwd: "/workspace" } } };
      }
    },
    1000,
    (x) => x,
    () => false,
    Error,
  );
  Object.assign(controller, {
    getRequestedThreadHistoryMode: () => "legacy",
    params: {
      prewarmedThreadManager: {
        hasPrewarmedThread: () => false,
        setPrewarmedThreadPromise: () => {
          calls.stored++;
        },
      },
      requestClient: {
        prewarmThreadStart: async () => {
          calls.requests++;
          return { thread: { id: "prewarm" } };
        },
      },
      setThreadReferencesSupported() {},
      logger: { warning: assert.fail },
    },
  });
  const inputs = async () => {
    calls.inputs++;
    return {};
  };
  inputs[Symbol.dispose] = () => {
    calls.disposed++;
  };
  return {
    calls,
    run: () =>
      controller.prewarmConversation(
        { cwd: "/workspace", workspaceRoots: ["/workspace"] },
        inputs,
      ),
  };
}

test("repeated browser opens do not prewarm or allocate threads", async () => {
  const f = fixture({ __ELECTRON_SHIM__: {} });
  for (let i = 0; i < 3; i++) await f.run();
  assert.deepEqual(f.calls, { inputs: 0, disposed: 3, requests: 0, stored: 0 });
});

for (const [name, window] of [
  ["desktop", {}],
  ["non-browser", undefined],
]) {
  test(`preserves ${name} prewarming`, async () => {
    const f = fixture(window);
    assert.equal((await f.run()).thread.id, "prewarm");
    assert.deepEqual(f.calls, {
      inputs: 1,
      disposed: 1,
      requests: 1,
      stored: 1,
    });
  });
}
