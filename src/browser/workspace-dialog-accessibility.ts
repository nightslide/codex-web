export function lockPageScroll(
  document: Pick<Document, "body" | "documentElement">,
  window: Pick<Window, "scrollX" | "scrollY" | "scrollTo">,
): () => void {
  const { body, documentElement } = document;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const bodyWasAlreadyFixed = body.style.position === "fixed";
  const bodyStyle = {
    left: body.style.left,
    overflow: body.style.overflow,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width,
  };
  const documentStyle = {
    overflow: documentElement.style.overflow,
    overscrollBehavior: documentElement.style.overscrollBehavior,
  };

  body.style.overflow = "hidden";
  if (!bodyWasAlreadyFixed) {
    body.style.left = "0";
    body.style.position = "fixed";
    body.style.right = "0";
    body.style.top = `${-scrollY}px`;
    body.style.width = "100%";
  }
  documentElement.style.overflow = "hidden";
  documentElement.style.overscrollBehavior = "none";

  let isLocked = true;
  return () => {
    if (!isLocked) {
      return;
    }
    isLocked = false;

    Object.assign(body.style, bodyStyle);
    Object.assign(documentElement.style, documentStyle);
    if (!bodyWasAlreadyFixed) {
      window.scrollTo(scrollX, scrollY);
    }
  };
}

export function trapDialogTabKey(
  event: Pick<KeyboardEvent, "key" | "preventDefault" | "shiftKey">,
  dialog: HTMLElement,
  activeElement: Element | null,
): void {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(isAvailableFocusTarget);

  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const activeIsInside =
    activeElement !== null && dialog.contains(activeElement);

  if (event.shiftKey && (!activeIsInside || activeElement === first)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && (!activeIsInside || activeElement === last)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function isAvailableFocusTarget(element: HTMLElement): boolean {
  if (
    element.hidden ||
    element.tabIndex < 0 ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }

  if (typeof element.getClientRects === "function") {
    return element.getClientRects().length > 0;
  }

  return true;
}
