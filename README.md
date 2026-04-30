# VFlow Desktop Recorder

Lightweight Windows Electron app that records desktop and browser workflows for VFlow SOPs.

## What it does

- Captures every mouse click anywhere on screen (with screenshot + active window title)
- Optional keystroke capture (off by default)
- Streams steps in real time to your VFlow workspace via a paired session

## Pairing

1. In VFlow → SOPs → click **Pair this PC** → copy the 6-digit code.
2. Launch VFlow Recorder.
3. Paste the code → Pair → done. The token is stored locally and reused on every launch.

## Recording

- Press **Ctrl+Shift+R** (or right-click the tray icon → Start Recording).
- Enter SOP title, optional description, optional account.
- Toggle **Capture keystrokes** ON if you want typing captured (default OFF, with red indicator when active).
- A small floating toolbar (top-right, draggable, always-on-top) shows: Pause · Add Note · Stop · step counter.

## Build locally

```bash
cd desktop-recorder
npm install
npm run build      # produces dist/VFlowRecorder-Setup-<version>.exe
```

## Build via GitHub Actions

Push a tag like `desktop-v0.1.0` (or commit changes under `desktop-recorder/**` on main) and the workflow at `.github/workflows/build-desktop.yml` builds the Windows installer on a `windows-latest` runner.

## Privacy notes

- Keystroke capture is opt-in per recording. The toolbar shows a red ⌨ indicator while active.
- A best-effort guard skips keystroke capture when the active window title contains `password`, `login`, or `sign in`.
- The session token only authorizes writes to the SOPs of the paired tenant. Revoke a device anytime from the SOPs page.
