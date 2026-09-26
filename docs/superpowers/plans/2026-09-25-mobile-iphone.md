# iPhone mobile UI implementation plan

**Goal:** Make the existing browser UI usable for reading, replying, navigating tasks and opening attachments on iPhone/Safari.

**Spec:** User-approved mobile plan in this conversation: task taps open tasks without pinning; one main pane; compact header; touch-accessible actions; keyboard-safe composer; contained code/table overflow; mobile dialogs and attachments; recovery after backgrounding.

**Architecture:** Keep browser adaptations in browser-owned CSS/TypeScript and small installation patches to the extracted renderer. Preserve desktop behavior and existing project, folder picker and download fixes. Use Luna 6 max for implementation and browser checks, as requested.

## Global constraints

- No edits to existing task messages for verification; use isolated browser contexts and synthetic fixtures as needed.
- Do not change real pins/projects without restoring their prior values.
- Keep phone pinch zoom, selection and Safari history navigation usable.
- Do not replay requests whose outcome is unknown after a lost connection.
- Browser emulation is evidence for layout and interactions, not proof of physical iPhone keyboard behavior.

## Tasks and ownership

- [x] Navigation: reproduce tap-to-pin; implement `patches/webview-mobile-navigation.patch` and optional `src/browser/mobile-navigation.ts`. Prove row tap, explicit pin action and scrolling behave distinctly.
- [x] Layout: implement `src/browser/mobile-layout.ts`, `src/browser/mobile.css` and optional renderer patch. Check narrow/landscape/desktop layouts, safe-area and viewport events without disabling zoom.
- [x] Dialogs: adapt `src/browser/workspace-root-dialog.tsx`, optional file handling, and `src/browser/mobile-dialogs.css`. Check one-folder selection, focus restoration, readable filenames and constrained dialogs.
- [x] Integration: parent owns `shim.ts`, `prepare_asar`, plan/ledger and reconnection wiring. Integrate hooks, build and launch an isolated instance on 8220. Audit existing draft persistence before changing recovery.
- [x] Review and verify: Luna reviews the combined diff and runs mobile/desktop browser smoke. Fix findings and compare evidence before/after; document any physical-device limits.
- [ ] Delivery: keep a dedicated feature branch, deploy the verified local version on the usual address using the established main/dev workflow, and provide concise verification and iPhone follow-up instructions. No new upstream PR without a request.

## Review focus

1. Touch target overlap and accidental pinning during row taps/scroll.
2. Keyboard resizing versus pinch zoom; no sticky height after blur/rotation.
3. Dialog focus/scroll lock restoration and nested dialogs.
4. Narrow content overflow without clipping copy/download/menu actions.
5. Reconnection must not duplicate submitted turns or discard a recoverable draft.

## Integration interfaces

Agents report import/initialization hooks to parent and own disjoint files. Parent alone changes `shim.ts` and `prepare_asar`; additions there are integrated sequentially. Shared scratch artifacts may receive disjoint patches, but all lasting edits must be represented in tracked sources/patches.

## Verification and remaining device checks

- Browser and server builds passed; 28 UI and existing regression tests passed.
- Chromium phone emulation: 390×844 portrait, 844×390 landscape, and a simulated 500px keyboard viewport keep the composer and dialog actions visible.
- Sidebar task rows and action targets are 44px on mobile without overlap; desktop retains 30px rows and hover actions.
- Folder selection remains single-select; Cancel restores focus and scroll state.
- Desktop/tablet widths of 1024 and 1440 remain outside the mobile layout rules.
- Connection interruption browser testing was explicitly stopped at the user's request and was not run for the final recovery implementation.
- Physical iPhone/Safari keyboard, safe-area, and pinch-zoom behavior still need device confirmation.
- The desktop File/Edit/View/Help menu strip remains available; collapsing it into a mobile menu is deferred.

## Release scope adjustment

The user asked to stop connection-interruption checks. Connection recovery changes were parked on the local `wip/mobile-connection-recovery` branch; this release retains the original connection behavior. The release contains only navigation, layout, dialog, and attachment presentation improvements. The parked work still has an IPC queue isolation finding and must not be deployed as-is.
