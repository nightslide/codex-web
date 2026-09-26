const MOBILE_LAYOUT_QUERY =
  "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";
const MOBILE_LAYOUT_STYLE_ID = "codex-mobile-layout-styles";
const KEYBOARD_OCCLUSION_THRESHOLD = 120;
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "reset",
  "submit",
]);

export type FocusedViewport = {
  height: number;
  top: number;
};

/**
 * Returns the visible viewport only while an editable control owns focus and
 * pinch zoom is inactive. Opening a chat therefore leaves focus and the
 * viewport alone.
 */
export function resolveFocusedViewport(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
  hasFocusedEditable: boolean,
  visualScale = 1,
): FocusedViewport | null {
  if (
    !hasFocusedEditable ||
    !Number.isFinite(layoutHeight) ||
    !Number.isFinite(visualHeight) ||
    !Number.isFinite(visualScale) ||
    layoutHeight <= 0 ||
    visualHeight <= 0 ||
    Math.abs(visualScale - 1) > 0.01
  ) {
    return null;
  }

  const height = Math.min(layoutHeight, visualHeight);
  const maxTop = Math.max(0, layoutHeight - height);
  const top = Number.isFinite(visualOffsetTop)
    ? Math.min(maxTop, Math.max(0, visualOffsetTop))
    : 0;

  return { height, top };
}

function hasFocusedEditable(doc: Document): boolean {
  const activeElement = doc.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  if (
    activeElement.isContentEditable ||
    activeElement.closest('[contenteditable="true"]')
  ) {
    return true;
  }

  if (activeElement.tagName === "TEXTAREA") {
    return !(activeElement as HTMLTextAreaElement).disabled;
  }

  if (activeElement.tagName !== "INPUT") {
    return false;
  }

  const input = activeElement as HTMLInputElement;
  return (
    !input.disabled && !input.readOnly && !NON_TEXT_INPUT_TYPES.has(input.type)
  );
}

function clearViewportOverrides(doc: Document): void {
  const root = doc.documentElement;
  root.removeAttribute("data-codex-mobile-keyboard-open");
  root.style.removeProperty("--codex-mobile-viewport-height");
  root.style.removeProperty("--codex-mobile-viewport-top");
}

function updateViewport(doc: Document, win: Window): void {
  const root = doc.documentElement;
  const visualViewport = win.visualViewport;

  if (!win.matchMedia(MOBILE_LAYOUT_QUERY).matches || !visualViewport) {
    clearViewportOverrides(doc);
    return;
  }

  const viewport = resolveFocusedViewport(
    win.innerHeight,
    visualViewport.height,
    visualViewport.offsetTop,
    hasFocusedEditable(doc),
    visualViewport.scale,
  );

  if (!viewport) {
    clearViewportOverrides(doc);
    return;
  }

  root.style.setProperty(
    "--codex-mobile-viewport-height",
    `${viewport.height}px`,
  );
  root.style.setProperty("--codex-mobile-viewport-top", `${viewport.top}px`);

  const keyboardOcclusion = Math.max(
    0,
    win.innerHeight - visualViewport.height,
  );
  if (keyboardOcclusion >= KEYBOARD_OCCLUSION_THRESHOLD) {
    root.setAttribute("data-codex-mobile-keyboard-open", "true");
  } else {
    root.removeAttribute("data-codex-mobile-keyboard-open");
  }
}

function makeViewportFitCover(doc: Document, isMobile: boolean): void {
  const viewportMeta = doc.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  if (!viewportMeta) {
    return;
  }

  const originalContent = viewportMeta.dataset.codexOriginalViewportContent;
  if (isMobile) {
    if (originalContent === undefined) {
      viewportMeta.dataset.codexOriginalViewportContent = viewportMeta.content;
    }
    if (!/\bviewport-fit\s*=/i.test(viewportMeta.content)) {
      viewportMeta.content = `${viewportMeta.content}, viewport-fit=cover`;
    }
    return;
  }

  if (originalContent !== undefined) {
    if (viewportMeta.content.endsWith(", viewport-fit=cover")) {
      viewportMeta.content = originalContent;
    }
    delete viewportMeta.dataset.codexOriginalViewportContent;
  }
}

/** Adds narrow-screen layout and visualViewport keyboard handling. */
export function installMobileLayout(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const win = window;
  const doc = document;
  const mobileQuery = win.matchMedia(MOBILE_LAYOUT_QUERY);
  let listenersAttached = false;
  let pendingFrame = 0;

  if (!doc.getElementById(MOBILE_LAYOUT_STYLE_ID)) {
    const stylesheet = doc.createElement("link");
    stylesheet.id = MOBILE_LAYOUT_STYLE_ID;
    stylesheet.rel = "stylesheet";
    stylesheet.media = MOBILE_LAYOUT_QUERY;
    stylesheet.href = new URL("./mobile.css", import.meta.url).href;
    doc.head.append(stylesheet);
  }

  makeViewportFitCover(doc, mobileQuery.matches);

  const update = () => updateViewport(doc, win);
  const updateAfterFocusChange = () => {
    if (pendingFrame) {
      win.cancelAnimationFrame(pendingFrame);
    }
    pendingFrame = win.requestAnimationFrame(() => {
      pendingFrame = 0;
      update();
    });
  };

  const attachViewportListeners = () => {
    if (listenersAttached) {
      return;
    }
    listenersAttached = true;
    win.addEventListener("resize", update, { passive: true });
    win.addEventListener("orientationchange", update, { passive: true });
    doc.addEventListener("focusin", update, true);
    doc.addEventListener("focusout", updateAfterFocusChange, true);
    win.visualViewport?.addEventListener("resize", update, { passive: true });
    win.visualViewport?.addEventListener("scroll", update, { passive: true });
    update();
  };

  const detachViewportListeners = () => {
    if (!listenersAttached) {
      return;
    }
    listenersAttached = false;
    win.removeEventListener("resize", update);
    win.removeEventListener("orientationchange", update);
    doc.removeEventListener("focusin", update, true);
    doc.removeEventListener("focusout", updateAfterFocusChange, true);
    win.visualViewport?.removeEventListener("resize", update);
    win.visualViewport?.removeEventListener("scroll", update);
    if (pendingFrame) {
      win.cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    }
    clearViewportOverrides(doc);
  };

  const onMediaChange = (event: MediaQueryListEvent) => {
    makeViewportFitCover(doc, event.matches);
    if (event.matches) {
      attachViewportListeners();
    } else {
      detachViewportListeners();
    }
  };

  if (mobileQuery.matches) {
    attachViewportListeners();
  }
  mobileQuery.addEventListener("change", onMediaChange);

  return () => {
    mobileQuery.removeEventListener("change", onMediaChange);
    detachViewportListeners();
    doc.getElementById(MOBILE_LAYOUT_STYLE_ID)?.remove();
    makeViewportFitCover(doc, false);
  };
}
