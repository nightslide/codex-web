import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lockPageScroll,
  trapDialogTabKey,
} from "../src/browser/workspace-dialog-accessibility.ts";

function makeScrollEnvironment() {
  const environment = {
    document: {
      body: {
        style: {
          left: "auto",
          overflow: "auto",
          position: "relative",
          right: "auto",
          top: "12px",
          width: "90%",
        },
      },
      documentElement: {
        style: { overflow: "scroll", overscrollBehavior: "contain" },
      },
    },
    window: {
      scrollX: 0,
      scrollY: 146,
      scrollToCalls: [],
      scrollTo(left, top) {
        this.scrollToCalls.push([left, top]);
      },
    },
  };
  return environment;
}

function makeFocusableElement() {
  return {
    tabIndex: 0,
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
    getAttribute() {
      return null;
    },
  };
}

function makeDialog(elements) {
  return {
    contains(element) {
      return elements.includes(element);
    },
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
    querySelectorAll() {
      return elements;
    },
  };
}

test("locks page scrolling and restores the original scroll position and styles", () => {
  const { document, window } = makeScrollEnvironment();
  const bodyStyleBefore = { ...document.body.style };
  const rootStyleBefore = { ...document.documentElement.style };

  const unlock = lockPageScroll(document, window);

  assert.equal(document.body.style.position, "fixed");
  assert.equal(document.body.style.top, "-146px");
  assert.equal(document.body.style.overflow, "hidden");
  assert.equal(document.documentElement.style.overflow, "hidden");

  unlock();

  assert.deepEqual(document.body.style, bodyStyleBefore);
  assert.deepEqual(document.documentElement.style, rootStyleBefore);
  assert.deepEqual(window.scrollToCalls, [[0, 146]]);
});

test("preserves an existing fixed-body scroll lock", () => {
  const { document, window } = makeScrollEnvironment();
  document.body.style.position = "fixed";
  document.body.style.top = "-72px";
  window.scrollY = 0;

  const unlock = lockPageScroll(document, window);

  assert.equal(document.body.style.top, "-72px");

  unlock();

  assert.equal(document.body.style.top, "-72px");
  assert.deepEqual(window.scrollToCalls, []);
});

test("wraps Shift+Tab from the first control to the last control", () => {
  const first = makeFocusableElement();
  const last = makeFocusableElement();
  const dialog = makeDialog([first, last]);
  let defaultPrevented = false;

  trapDialogTabKey(
    {
      key: "Tab",
      preventDefault() {
        defaultPrevented = true;
      },
      shiftKey: true,
    },
    dialog,
    first,
  );

  assert.equal(defaultPrevented, true);
  assert.equal(last.focusCalls, 1);
});

test("wraps Tab from the last control to the first control", () => {
  const first = makeFocusableElement();
  const last = makeFocusableElement();
  const dialog = makeDialog([first, last]);
  let defaultPrevented = false;

  trapDialogTabKey(
    {
      key: "Tab",
      preventDefault() {
        defaultPrevented = true;
      },
      shiftKey: false,
    },
    dialog,
    last,
  );

  assert.equal(defaultPrevented, true);
  assert.equal(first.focusCalls, 1);
});
