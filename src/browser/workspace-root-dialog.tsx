import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CloseIcon, FolderIcon, UpIcon } from "./icons";
import {
  lockPageScroll,
  trapDialogTabKey,
} from "./workspace-dialog-accessibility";

const MOBILE_DIALOG_STYLESHEET_URL = new URL(
  "./mobile-dialogs.css",
  import.meta.url,
).href;
const MOBILE_DIALOG_STYLESHEET_ID = "codex-web-mobile-dialog-stylesheet";
let mobileDialogStylesheetPromise: Promise<void> | null = null;

export function installMobileDialogStylesheet(): Promise<void> {
  const existingStylesheet = document.getElementById(
    MOBILE_DIALOG_STYLESHEET_ID,
  );
  if (existingStylesheet) {
    return mobileDialogStylesheetPromise ?? Promise.resolve();
  }

  if (!mobileDialogStylesheetPromise) {
    mobileDialogStylesheetPromise = new Promise((resolve) => {
      const stylesheet = document.createElement("link");
      stylesheet.id = MOBILE_DIALOG_STYLESHEET_ID;
      stylesheet.rel = "stylesheet";
      stylesheet.href = MOBILE_DIALOG_STYLESHEET_URL;
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => {
        console.error("[codex-web] Could not load mobile dialog styles");
        resolve();
      };
      document.head.append(stylesheet);
    });
  }

  return mobileDialogStylesheetPromise;
}

export type WorkspaceDirectoryEntry = {
  name: string;
  path: string;
  type: "directory" | "file";
};

export type WorkspaceDirectoryEntries = {
  directoryPath: string;
  parentPath: string | null;
  entries: WorkspaceDirectoryEntry[];
};

const TITLE_ID = "codex-web-workspace-root-dialog-title";
const DESCRIPTION_ID = "codex-web-workspace-root-dialog-description";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function WorkspaceRootDialog({
  listDirectory,
  onClose,
}: WorkspaceRootDialogOptions & {
  onClose: (value: string | null) => void;
}): React.ReactElement {
  const [directoryPath, setDirectoryPath] = useState<string | null>(null);
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const directoryQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => listDirectory(directoryPath),
    queryKey: ["workspace-directory-entries", directoryPath],
    retry: false,
  });
  const entries = useMemo(
    () =>
      directoryQuery.data?.entries.filter(
        (entry) => entry.type === "directory",
      ) ?? [],
    [directoryQuery.data?.entries],
  );
  const parentPath = directoryQuery.data?.parentPath ?? null;
  const isBusy = directoryQuery.isFetching;
  const isLoading = directoryQuery.isPending && !directoryQuery.data;
  const queryError = directoryQuery.isError
    ? errorMessage(directoryQuery.error)
    : null;

  function navigateTo(nextDirectoryPath: string): void {
    setUserSelectedPath(nextDirectoryPath);
    setDirectoryPath(nextDirectoryPath);
  }

  useEffect(() => {
    const unlockPageScroll = lockPageScroll(document, window);
    dialogRef.current?.focus({ preventScroll: true });
    return unlockPageScroll;
  }, []);

  const selectedPath = userSelectedPath ?? directoryQuery.data?.directoryPath;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedPath && !isBusy) {
      onClose(selectedPath);
    }
  }

  function handleDialogKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose(null);
      return;
    }

    if (event.key === "Tab") {
      event.stopPropagation();
    }
    trapDialogTabKey(
      event,
      event.currentTarget,
      event.currentTarget.ownerDocument.activeElement,
    );
  }

  const selectedPathValue = selectedPath ?? "";

  return (
    <>
      <div
        aria-hidden="true"
        className={[
          "extension:bg-token-editor-background/80",
          "electron:bg-[#00000022]",
          "codex-dialog-overlay",
          "fixed",
          "inset-0",
          "z-50",
        ].join(" ")}
        data-codex-mobile-dialog-overlay="workspace-root"
        data-state="open"
        onClick={() => onClose(null)}
        style={{ pointerEvents: "auto" }}
      />
      <div
        aria-describedby={DESCRIPTION_ID}
        aria-labelledby={TITLE_ID}
        aria-modal="true"
        className={[
          "codex-dialog",
          "left-1/2",
          "top-1/2",
          "z-50",
          "-translate-x-1/2",
          "-translate-y-1/2",
          "outline-none",
          "fixed",
          "bg-token-dropdown-background",
          "text-token-foreground",
          "ring-token-border",
          "max-w-[92vw]",
          "rounded-3xl",
          "ring-[0.5px]",
          "ring-token-border",
          "shadow-lg",
          "backdrop-blur-xl",
          "w-[520px]",
        ].join(" ")}
        data-codex-mobile-dialog="workspace-root"
        data-state="open"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        style={{ pointerEvents: "auto" }}
        tabIndex={-1}
      >
        <form
          className={[
            "flex",
            "flex-col",
            "gap-0",
            "codex-mobile-dialog-form",
          ].join(" ")}
          data-codex-mobile-dialog-form="workspace-root"
          onSubmit={handleSubmit}
        >
          <div
            className={[
              "flex",
              "flex-col",
              "gap-0",
              "px-5",
              "py-5",
              "text-base",
              "leading-normal",
              "tracking-normal",
              "codex-mobile-dialog-body",
            ].join(" ")}
            data-codex-mobile-dialog-body="workspace-root"
          >
            <div
              className={[
                "flex",
                "w-full",
                "flex-col",
                "pt-3",
                "first:pt-0",
              ].join(" ")}
            >
              <div
                className={["flex", "flex-col", "items-start", "gap-3"].join(
                  " ",
                )}
              >
                <div
                  className={[
                    "flex",
                    "min-w-0",
                    "flex-1",
                    "flex-col",
                    "gap-1",
                    "self-stretch",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "heading-dialog",
                      "min-w-0",
                      "font-semibold",
                    ].join(" ")}
                    id={TITLE_ID}
                  >
                    Add remote project
                  </div>
                  <div className={["sr-only"].join(" ")} id={DESCRIPTION_ID}>
                    Choose a folder on the Codex Web host to add as a project.
                  </div>
                </div>
              </div>
            </div>

            <div
              className={[
                "flex",
                "w-full",
                "flex-col",
                "pt-3",
                "first:pt-0",
                "gap-2",
              ].join(" ")}
            >
              <label className={["flex", "flex-col", "gap-0.5"].join(" ")}>
                <span
                  className={["font-medium", "text-token-text-primary"].join(
                    " ",
                  )}
                >
                  Select folder
                </span>
                <div
                  className={[
                    "flex",
                    "h-70",
                    "min-h-56",
                    "flex-col",
                    "gap-3",
                    "codex-mobile-folder-picker",
                  ].join(" ")}
                  data-codex-mobile-folder-picker="true"
                >
                  <div
                    className={[
                      "flex",
                      "min-h-0",
                      "min-w-0",
                      "flex-1",
                      "flex-col",
                      "codex-mobile-folder-picker-content",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-1",
                        "mb-2",
                        "flex",
                        "min-w-0",
                        "items-center",
                        "gap-1",
                        "codex-mobile-path-row",
                      ].join(" ")}
                      data-codex-mobile-path-row="true"
                    >
                      <button
                        aria-label="Enclosing folder"
                        className={[
                          "border-token-border",
                          "user-select-none",
                          "no-drag",
                          "cursor-interaction",
                          "flex",
                          "items-center",
                          "gap-1",
                          "border",
                          "whitespace-nowrap",
                          "focus:outline-none",
                          "disabled:cursor-not-allowed",
                          "disabled:opacity-40",
                          "rounded-full",
                          "text-token-description-foreground",
                          "enabled:hover:bg-token-list-hover-background",
                          "data-[state=open]:bg-token-list-hover-background",
                          "border-transparent",
                          "h-token-button-composer-sm",
                          "px-1.5",
                          "py-0",
                          "text-sm",
                          "leading-[18px]",
                          "aspect-square",
                          "items-center",
                          "justify-center",
                          "!px-0",
                          "shrink-0",
                          "codex-mobile-parent-button",
                        ].join(" ")}
                        disabled={!parentPath || isBusy}
                        onClick={() => {
                          if (parentPath) {
                            navigateTo(parentPath);
                          }
                        }}
                        type="button"
                      >
                        <UpIcon />
                      </button>
                      <input
                        aria-label="Selected folder path"
                        className={[
                          "w-full",
                          "min-w-0",
                          "flex-1",
                          "rounded-md",
                          "border",
                          "border-token-input-border",
                          "bg-token-input-background",
                          "px-2.5",
                          "py-1.5",
                          "text-sm",
                          "text-token-input-foreground",
                          "outline-none",
                          "disabled:bg-token-foreground/5",
                          "disabled:text-token-text-secondary",
                          "disabled:opacity-100",
                        ].join(" ")}
                        disabled
                        readOnly
                        spellCheck={false}
                        title={selectedPathValue}
                        value={selectedPathValue}
                      />
                    </div>

                    <div
                      className={[
                        "min-h-0",
                        "flex-1",
                        "bg-token-input-background",
                        "border-token-input-border",
                        "flex",
                        "overflow-y-auto",
                        "rounded-lg",
                        "border",
                        "codex-mobile-folder-list-scroll",
                      ].join(" ")}
                      aria-busy={isBusy}
                      aria-label="Available folders"
                      data-codex-mobile-folder-list="true"
                      role="list"
                    >
                      <div
                        className={[
                          "flex",
                          "w-full",
                          "flex-col",
                          "py-1",
                          "codex-mobile-folder-list",
                        ].join(" ")}
                      >
                        {isLoading ? (
                          <div
                            className={[
                              "px-3",
                              "py-2",
                              "text-sm",
                              "text-token-description-foreground",
                            ].join(" ")}
                            role="status"
                          >
                            Loading...
                          </div>
                        ) : queryError ? (
                          <div
                            className={[
                              "px-3",
                              "py-2",
                              "text-sm",
                              "text-token-text-error",
                            ].join(" ")}
                            role="alert"
                          >
                            {queryError}
                          </div>
                        ) : entries.length === 0 ? (
                          <div
                            className={[
                              "px-3",
                              "py-2",
                              "text-sm",
                              "text-token-description-foreground",
                            ].join(" ")}
                          >
                            No folders
                          </div>
                        ) : (
                          entries.map((entry) => {
                            const selected = entry.path === selectedPath;
                            return (
                              <div
                                className="codex-mobile-folder-row"
                                data-codex-mobile-folder-row="true"
                                role="listitem"
                                key={entry.path}
                              >
                                <button
                                  aria-label={`Select folder ${entry.name}`}
                                  aria-pressed={selected}
                                  className={[
                                    "flex",
                                    "w-full",
                                    "min-w-0",
                                    "self-stretch",
                                    "items-center",
                                    "gap-2",
                                    "px-3",
                                    "py-1.5",
                                    "text-left",
                                    "text-sm",
                                    "hover:bg-token-foreground/5",
                                    selected
                                      ? "bg-token-list-hover-background"
                                      : "",
                                    "codex-mobile-folder-select",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  data-path={entry.path}
                                  onClick={() => {
                                    setUserSelectedPath(entry.path);
                                  }}
                                  onDoubleClick={() => {
                                    navigateTo(entry.path);
                                  }}
                                  title={entry.path}
                                  type="button"
                                >
                                  <FolderIcon />
                                  <span data-codex-mobile-folder-name="true">
                                    {entry.name}
                                  </span>
                                </button>
                                <button
                                  aria-label={`Open folder ${entry.name}`}
                                  className="codex-mobile-open-folder"
                                  onClick={() => navigateTo(entry.path)}
                                  type="button"
                                >
                                  Open
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>
          <div
            className={[
              "flex",
              "w-full",
              "flex-col",
              "pt-3",
              "first:pt-0",
              "codex-mobile-dialog-footer",
              "px-5",
              "pb-5",
            ].join(" ")}
            data-codex-mobile-dialog-footer="workspace-root"
          >
            <div
              className={[
                "flex",
                "w-full",
                "items-center",
                "justify-end",
                "gap-3",
                "codex-mobile-dialog-actions",
              ].join(" ")}
              data-codex-mobile-dialog-actions="workspace-root"
            >
              <button
                aria-label="Cancel adding a remote project"
                className={[
                  "border-token-border",
                  "user-select-none",
                  "no-drag",
                  "cursor-interaction",
                  "flex",
                  "items-center",
                  "gap-1",
                  "border",
                  "whitespace-nowrap",
                  "focus:outline-none",
                  "disabled:cursor-not-allowed",
                  "disabled:opacity-40",
                  "rounded-lg",
                  "text-token-description-foreground",
                  "enabled:hover:bg-token-list-hover-background",
                  "data-[state=open]:bg-token-list-hover-background",
                  "border-transparent",
                  "px-4",
                  "py-1.5",
                  "text-base",
                  "leading-[18px]",
                ].join(" ")}
                onClick={() => onClose(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-label="Add project from selected folder"
                className={[
                  "border-token-border",
                  "user-select-none",
                  "no-drag",
                  "cursor-interaction",
                  "flex",
                  "items-center",
                  "gap-1",
                  "border",
                  "whitespace-nowrap",
                  "focus:outline-none",
                  "disabled:cursor-not-allowed",
                  "disabled:opacity-40",
                  "rounded-lg",
                  "bg-token-foreground",
                  "enabled:hover:bg-token-foreground/80",
                  "data-[state=open]:bg-token-foreground/80",
                  "text-token-dropdown-background",
                  "px-4",
                  "py-1.5",
                  "text-base",
                  "leading-[18px]",
                ].join(" ")}
                disabled={!selectedPath || isBusy}
                type="submit"
              >
                Add project
              </button>
            </div>
          </div>
        </form>

        <button
          aria-label="Close folder picker"
          data-codex-mobile-dialog-close="workspace-root"
          className={[
            "no-drag",
            "absolute",
            "top-4",
            "right-4",
            "cursor-interaction",
            "rounded",
            "p-1",
            "leading-none",
            "text-token-foreground/80",
            "hover:bg-token-toolbar-hover-background",
            "focus:ring-1",
            "focus:ring-token-focus-border",
            "focus:outline-none",
          ].join(" ")}
          onClick={() => onClose(null)}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
    </>
  );
}

function ensureHost(activeElement: Element | null): {
  element: HTMLElement;
  restore: () => void;
} {
  const DIALOG_ID = "codex-web-workspace-root-dialog";
  let element = document.getElementById(DIALOG_ID);
  if (!element) {
    element = document.createElement("div");
    element.id = DIALOG_ID;
    // Keep pointer and focus events inside this browser dialog so the
    // application's underlying modal does not dismiss itself.
    for (const type of ["pointerdown", "mousedown", "click", "focusin"]) {
      element.addEventListener(type, (event) => event.stopPropagation());
    }
  }
  const outerDialog = activeElement?.closest<HTMLElement>('[role="dialog"]');
  if (!outerDialog) {
    document.body.append(element);
    return { element, restore: () => element.remove() };
  }

  const rect = outerDialog.getBoundingClientRect();
  const { left, top, translate, backdropFilter, overflow } = outerDialog.style;
  outerDialog.style.left = `${rect.left}px`;
  outerDialog.style.top = `${rect.top}px`;
  outerDialog.style.translate = "none";
  outerDialog.style.backdropFilter = "none";
  outerDialog.style.overflow = "visible";
  outerDialog.append(element);

  return {
    element,
    restore: () => {
      element.remove();
      outerDialog.style.left = left;
      outerDialog.style.top = top;
      outerDialog.style.translate = translate;
      outerDialog.style.backdropFilter = backdropFilter;
      outerDialog.style.overflow = overflow;
    },
  };
}

type WorkspaceRootDialogOptions = {
  listDirectory: (
    directoryPath: string | null,
  ) => Promise<WorkspaceDirectoryEntries>;
};

export async function openSelectWorkspaceRootDialog({
  listDirectory,
}: WorkspaceRootDialogOptions): Promise<string | null> {
  await installMobileDialogStylesheet();
  const activeElement = document.activeElement;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const { resolveFn, promise } = ((): {
    promise: Promise<string | null>;
    resolveFn: (target: string | null) => void;
  } => {
    let resolveFn = null;
    const promise = new Promise<string | null>((resolve) => {
      resolveFn = resolve;
    });

    return {
      resolveFn: resolveFn as any,
      promise,
    };
  })();

  const { element, restore } = ensureHost(activeElement);
  const reactRoot = createRoot(element);
  reactRoot.render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceRootDialog listDirectory={listDirectory} onClose={resolveFn} />
    </QueryClientProvider>,
  );

  let result: string | null;
  try {
    result = await promise;
  } finally {
    reactRoot.unmount();
    restore();
    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      activeElement.focus({ preventScroll: true });
    }
  }

  return result;
}
