// Global capture engine: mouse clicks + (opt-in) keystrokes, plus screenshots
// of the primary screen on click.
const { desktopCapturer, screen } = require('electron');

let uIOhook, UiohookKey;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (e) {
  console.warn('uiohook-napi not available:', e.message);
}

let activeWin;
try {
  activeWin = require('active-win');
} catch (e) {
  console.warn('active-win not available:', e.message);
}

const state = {
  recording: false,
  paused: false,
  captureKeystrokes: false,
  passwordKeywords: [],
  onStep: null, // async (step) => void
  typeBuffer: { text: '', timer: null, windowTitle: '' },
};

const TYPE_DEBOUNCE_MS = 1200;

async function getActiveWindowTitle() {
  if (!activeWin) return '';
  try {
    const w = await activeWin();
    return w?.title || w?.owner?.name || '';
  } catch { return ''; }
}

async function captureScreenshot() {
  try {
    const { width, height } = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.min(1920, width),
        height: Math.min(1920, Math.round(height * (1920 / Math.max(width, 1)))),
      },
    });
    if (!sources.length) return null;
    return sources[0].thumbnail.toDataURL(); // data:image/png;base64,...
  } catch (e) {
    console.warn('Screenshot failed:', e.message);
    return null;
  }
}

function isSensitiveWindow(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return state.passwordKeywords.some(k => t.includes(k));
}

function flushTypeBuffer() {
  if (!state.typeBuffer.text || !state.onStep) {
    state.typeBuffer = { text: '', timer: null, windowTitle: '' };
    return;
  }
  const step = {
    title: `Typed in ${state.typeBuffer.windowTitle || 'window'}`,
    description: state.typeBuffer.text,
    step_type: 'type',
    annotation_data: { window: state.typeBuffer.windowTitle },
  };
  state.typeBuffer = { text: '', timer: null, windowTitle: '' };
  state.onStep(step).catch(err => console.warn('writeStep failed:', err.message));
}

async function handleClick(e) {
  if (!state.recording || state.paused) return;
  // Flush any pending typing first so click order is preserved
  if (state.typeBuffer.text) flushTypeBuffer();

  const winTitle = await getActiveWindowTitle();
  const screenshot = await captureScreenshot();
  const step = {
    title: `Click in ${winTitle || 'screen'}`,
    description: `Clicked at (${e.x}, ${e.y})`,
    step_type: 'click',
    click_x: e.x,
    click_y: e.y,
    screenshot_base64: screenshot,
    annotation_data: { window: winTitle, button: e.button },
  };
  if (state.onStep) {
    state.onStep(step).catch(err => console.warn('writeStep failed:', err.message));
  }
}

async function handleKey(e) {
  if (!state.recording || state.paused || !state.captureKeystrokes) return;

  const winTitle = await getActiveWindowTitle();
  if (isSensitiveWindow(winTitle)) return; // privacy guard

  // Convert keycode to character (best-effort; uiohook gives keychar where possible)
  let ch = '';
  if (e.keychar && e.keychar > 0) {
    ch = String.fromCharCode(e.keychar);
  } else if (UiohookKey) {
    const map = {
      [UiohookKey.Space]: ' ',
      [UiohookKey.Enter]: '⏎',
      [UiohookKey.Tab]: '⇥',
      [UiohookKey.Backspace]: '⌫',
    };
    ch = map[e.keycode] || '';
  }
  if (!ch) return;

  if (state.typeBuffer.windowTitle && state.typeBuffer.windowTitle !== winTitle) {
    flushTypeBuffer();
  }
  state.typeBuffer.text += ch;
  state.typeBuffer.windowTitle = winTitle;
  if (state.typeBuffer.timer) clearTimeout(state.typeBuffer.timer);
  state.typeBuffer.timer = setTimeout(flushTypeBuffer, TYPE_DEBOUNCE_MS);
}

function start({ captureKeystrokes, passwordKeywords, onStep }) {
  if (!uIOhook) throw new Error('uiohook-napi not installed');
  state.recording = true;
  state.paused = false;
  state.captureKeystrokes = !!captureKeystrokes;
  state.passwordKeywords = passwordKeywords || [];
  state.onStep = onStep;

  uIOhook.on('mouseup', handleClick);
  uIOhook.on('keydown', handleKey);
  try { uIOhook.start(); } catch (e) { console.warn('uiohook start:', e.message); }
}

function pause() { state.paused = true; if (state.typeBuffer.text) flushTypeBuffer(); }
function resume() { state.paused = false; }

function stop() {
  if (state.typeBuffer.text) flushTypeBuffer();
  state.recording = false;
  try { uIOhook && uIOhook.stop(); } catch {}
  try { uIOhook && uIOhook.removeAllListeners('mouseup'); } catch {}
  try { uIOhook && uIOhook.removeAllListeners('keydown'); } catch {}
  state.onStep = null;
}

function isRecording() { return state.recording; }
function isPaused() { return state.paused; }

module.exports = { start, pause, resume, stop, isRecording, isPaused };
