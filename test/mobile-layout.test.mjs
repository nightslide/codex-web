import assert from "node:assert/strict";
import test from "node:test";
import { resolveFocusedViewport } from "../src/browser/mobile-layout.ts";

test("does not apply visual viewport resizing until a text editor is focused", () => {
  assert.equal(resolveFocusedViewport(844, 520, 120, false), null);
});

test("uses the visible viewport while a text editor is focused", () => {
  assert.deepEqual(resolveFocusedViewport(844, 520, 120, true), {
    height: 520,
    top: 120,
  });
});

test("clamps focused viewport dimensions to the layout viewport", () => {
  assert.deepEqual(resolveFocusedViewport(844, 900, 40, true), {
    height: 844,
    top: 0,
  });
});

test("does not resize the layout while the user is pinch zooming", () => {
  assert.equal(resolveFocusedViewport(844, 420, 160, true, 2), null);
});

test("ignores unusable viewport measurements", () => {
  assert.equal(resolveFocusedViewport(0, 520, 0, true), null);
  assert.equal(resolveFocusedViewport(844, Number.NaN, 0, true), null);
});
