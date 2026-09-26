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
const start = asset.indexOf("    _storeEventToStorage(e) {");
const end = asset.indexOf("    _getEventsFromStorage(e) {", start);
assert.ok(
  start >= 0 && end > start,
  "prepared renderer contains the event storage method",
);
const create = new Function(
  "window",
  "p",
  "i",
  "s",
  `return ({${asset.slice(start, end)}})`,
);

function run(window, disableStorage, logging = "disabled") {
  let writes = 0;
  let reads = 0;
  let stored;
  const logger = create(
    window,
    {
      _setObjectInStorage: (_, value) => {
        writes++;
        stored = value;
      },
    },
    { EventRetryConstants: { MAX_LOCAL_STORAGE: 500 } },
    { Log: { warn: assert.fail } },
  );
  Object.assign(logger, {
    _loggingEnabled: logging,
    _options: { disableStorage },
    _getStorageKey: () => "events",
    _getEventsFromStorage: () => {
      reads++;
      return [{ event: "existing" }];
    },
  });
  logger._storeEventToStorage({ event: "new" });
  return { reads, writes, stored };
}

test("does not build a disabled, nonpersistent browser analytics backlog", () => {
  assert.deepEqual(run({ __ELECTRON_SHIM__: {} }, true), {
    reads: 0,
    writes: 0,
    stored: undefined,
  });
});

for (const [name, window, disabled, logging] of [
  ["persistent browser logging", { __ELECTRON_SHIM__: {} }, false, "disabled"],
  ["desktop renderer", {}, true, "disabled"],
  ["non-browser runtime", undefined, true, "disabled"],
  ["enabled analytics", { __ELECTRON_SHIM__: {} }, true, "browser-only"],
]) {
  test(`preserves buffering for ${name}`, () => {
    assert.deepEqual(run(window, disabled, logging), {
      reads: 1,
      writes: 1,
      stored: [{ event: "existing" }, { event: "new" }],
    });
  });
}
