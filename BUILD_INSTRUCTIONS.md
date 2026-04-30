# Building VFlow Recorder — Windows EXE

## Requirements (on your Windows machine or CI)
- **Node.js** v18 or later → https://nodejs.org
- **npm** (comes with Node.js)
- **Windows Build Tools** (for native modules):
  ```
  npm install --global windows-build-tools
  ```
  Or install **Visual Studio Build Tools** with "Desktop development with C++"

## Steps

### 1. Install dependencies
```
npm install
```

### 2. Add an app icon (optional but recommended)
Place these files in the `assets/` folder:
- `icon.ico` — 256×256 multi-resolution Windows icon
- `icon.png` — 512×512 PNG

If omitted, electron-builder will use its default icon.

### 3. Build the installer (.exe)
```
npm run build
```
This runs:  `electron-builder --win nsis --x64 --publish never`

Output will be in the `dist/` folder:
- `VFlowRecorder-Setup-0.2.1.exe` — Windows NSIS installer

### 4. Build a portable EXE (no installer, single file)
```
npm run build:portable
```
Output: `dist/VFlow Recorder 0.2.1.exe` — runs without installation

## Troubleshooting

### "node-gyp" or "node-pre-gyp" errors
The app uses native modules (`active-win`, `uiohook-napi`) that require C++ compilation.
Make sure Visual Studio Build Tools are installed:
```
npm install --global node-gyp
npm install --global windows-build-tools
```

### Icon missing warning
Add `assets/icon.ico` before building for a branded icon. See `assets/README.md`.

## GitHub Actions (automated CI build)
You can use the included workflow or add this to `.github/workflows/build.yml`:

```yaml
name: Build Windows EXE
on: [push]
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: VFlowRecorder-Setup
          path: dist/*.exe
```
