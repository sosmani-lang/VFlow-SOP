const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, shell, nativeImage } = require('electron');
const path = require('path');

const store = require('./store.cjs');
const api = require('./api.cjs');
const capture = require('./capture.cjs');

let mainWindow = null;
let toolbarWindow = null;
let tray = null;
let currentSopId = null;
let stepCount = 0;

// ─── Windows ────────────────────────────────────────────────────────────
function createMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createToolbarWindow() {
  toolbarWindow = new BrowserWindow({
    width: 360,
    height: 56,
    x: undefined,
    y: 16,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Allow microphone access for voice narration
  toolbarWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture') return callback(true);
    callback(false);
  });
  toolbarWindow.loadFile(path.join(__dirname, 'renderer', 'recording.html'));
  toolbarWindow.setVisibleOnAllWorkspaces(true);
}

function destroyToolbarWindow() {
  if (toolbarWindow) { toolbarWindow.close(); toolbarWindow = null; }
}

// ─── Tray ───────────────────────────────────────────────────────────────
function buildTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('VFlow Recorder');
  refreshTrayMenu();
  tray.on('click', () => createMainWindow());
}

function refreshTrayMenu() {
  if (!tray) return;
  const session = store.getSession();
  const recording = capture.isRecording();
  const menu = Menu.buildFromTemplate([
    { label: session ? 'Open VFlow Recorder' : 'Pair this PC', click: () => createMainWindow() },
    { type: 'separator' },
    {
      label: recording ? 'Stop Recording' : 'Start Recording (Ctrl+Shift+R)',
      enabled: !!session,
      click: () => recording ? stopRecording() : createMainWindow(),
    },
    { label: 'Open SOPs in Browser', enabled: !!session, click: () => shell.openExternal('https://productivity.vflowapps.ca') },
    { type: 'separator' },
    { label: 'Unpair', enabled: !!session, click: () => { store.clearSession(); refreshTrayMenu(); createMainWindow(); } },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ─── Recording orchestration ────────────────────────────────────────────
async function startRecording({ title, description, accountId, captureKeystrokes }) {
  const session = store.getSession();
  if (!session) throw new Error('Not paired');
  if (capture.isRecording()) throw new Error('Already recording');

  const { sop_id } = await api.createSop(session.session_token, { title, description, accountId });
  currentSopId = sop_id;
  stepCount = 0;

  const settings = store.getSettings();
  capture.start({
    captureKeystrokes: !!captureKeystrokes,
    passwordKeywords: settings.passwordSkipKeywords,
    onStep: async (step) => {
      try {
        await api.writeStep(session.session_token, currentSopId, step);
        stepCount += 1;
        if (toolbarWindow) toolbarWindow.webContents.send('vflow:status', { stepCount, captureKeystrokes });
      } catch (err) { console.warn('writeStep error:', err.message); }
    },
  });

  createToolbarWindow();
  if (mainWindow) mainWindow.hide();
  refreshTrayMenu();
  return { sop_id };
}

function pauseRecording() { capture.pause(); if (toolbarWindow) toolbarWindow.webContents.send('vflow:status', { paused: true }); }
function resumeRecording() { capture.resume(); if (toolbarWindow) toolbarWindow.webContents.send('vflow:status', { paused: false }); }

function stopRecording() {
  if (!capture.isRecording()) return;
  capture.stop();
  destroyToolbarWindow();
  refreshTrayMenu();
  const finalCount = stepCount;
  const sopId = currentSopId;
  currentSopId = null;
  stepCount = 0;
  try {
    new Notification({
      title: 'VFlow Recorder',
      body: `SOP saved with ${finalCount} step${finalCount === 1 ? '' : 's'}. Open in browser?`,
    }).on('click', () => {
      const url = `https://productivity.vflowapps.ca`;
      shell.openExternal(sopId ? `${url}` : url);
    }).show();
  } catch {}
  return { sopId, stepCount: finalCount };
}

async function addNote(text) {
  const session = store.getSession();
  if (!session || !currentSopId) return;
  await api.writeStep(session.session_token, currentSopId, {
    title: 'Note',
    description: text || '',
    step_type: 'note',
  });
  stepCount += 1;
  if (toolbarWindow) toolbarWindow.webContents.send('vflow:status', { stepCount });
}

async function addVoiceStep({ audioB64, mimeType }) {
  const session = store.getSession();
  if (!session || !currentSopId) throw new Error('Not recording');
  // Attach the transcript to the most recently captured step so the voice
  // narration syncs with the action it describes. The edge function falls
  // back to creating a 'voice' step if no steps exist yet.
  const result = await api.attachVoiceToStep(session.session_token, currentSopId, { audioB64, mimeType });
  if (!result.attached) {
    // A new standalone voice step was created
    stepCount += 1;
    if (toolbarWindow) toolbarWindow.webContents.send('vflow:status', { stepCount });
  }
  return { transcript: result.transcript };
}

// ─── IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('vflow:isPaired', () => !!store.getSession());
ipcMain.handle('vflow:getSession', () => {
  const s = store.getSession();
  if (!s) return null;
  // Don't expose the raw token to the renderer
  return { tenant_id: s.tenant_id, profile_id: s.profile_id, device_kind: s.device_kind, paired_at: s.paired_at };
});
ipcMain.handle('vflow:pair', async (_e, code) => {
  const os = require('os');
  const label = `${os.hostname()} (${process.platform})`;
  const result = await api.exchangeCode(String(code).trim(), label);
  store.setSession({
    session_token: result.session_token,
    tenant_id: result.tenant_id,
    profile_id: result.profile_id,
    device_kind: result.device_kind,
    paired_at: new Date().toISOString(),
  });
  refreshTrayMenu();
  return { ok: true };
});
ipcMain.handle('vflow:unpair', () => { store.clearSession(); refreshTrayMenu(); return { ok: true }; });
ipcMain.handle('vflow:startRecording', (_e, opts) => startRecording(opts));
ipcMain.handle('vflow:pauseRecording', () => pauseRecording());
ipcMain.handle('vflow:resumeRecording', () => resumeRecording());
ipcMain.handle('vflow:stopRecording', () => stopRecording());
ipcMain.handle('vflow:addNote', (_e, text) => addNote(text));
ipcMain.handle('vflow:addVoice', (_e, payload) => addVoiceStep(payload));

// ─── App lifecycle ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => createMainWindow());
  app.whenReady().then(() => {
    buildTray();
    createMainWindow();
    const settings = store.getSettings();
    try {
      globalShortcut.register(settings.hotkeyStart, () => {
        if (capture.isRecording()) stopRecording();
        else createMainWindow();
      });
      globalShortcut.register(settings.hotkeyNote, () => {
        if (capture.isRecording()) addNote(`Manual note @ ${new Date().toLocaleTimeString()}`);
      });
    } catch (e) { console.warn('Hotkey register failed:', e.message); }
  });
  app.on('window-all-closed', (e) => { e.preventDefault(); });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); });
}
