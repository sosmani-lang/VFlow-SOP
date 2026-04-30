/* eslint-disable no-undef */
let paused = false;

const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const noteBtn = document.getElementById('note-btn');
const micBtn = document.getElementById('mic-btn');
const countEl = document.getElementById('rec-count');
const keysEl = document.getElementById('rec-keys');

window.vflow.onStatus((s) => {
  if (typeof s.stepCount === 'number') countEl.textContent = `${s.stepCount} step${s.stepCount === 1 ? '' : 's'}`;
  if (typeof s.captureKeystrokes === 'boolean') keysEl.classList.toggle('hidden', !s.captureKeystrokes);
  if (typeof s.paused === 'boolean') {
    paused = s.paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
  }
});

pauseBtn.addEventListener('click', async () => {
  if (paused) await window.vflow.resumeRecording();
  else await window.vflow.pauseRecording();
});

stopBtn.addEventListener('click', () => window.vflow.stopRecording());

noteBtn.addEventListener('click', async () => {
  const text = prompt('Add note:');
  if (text) await window.vflow.addNote(text);
});

// ─── Voice narration ────────────────────────────────────────────────────
let mediaRecorder = null;
let mediaStream = null;
let chunks = [];
let voiceBusy = false;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const idx = s.indexOf(',');
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function setMicState(state) {
  // state: 'idle' | 'recording' | 'sending'
  micBtn.classList.remove('mic-recording', 'mic-sending');
  if (state === 'recording') {
    micBtn.classList.add('mic-recording');
    micBtn.textContent = '⏺';
    micBtn.title = 'Click to stop & transcribe';
  } else if (state === 'sending') {
    micBtn.classList.add('mic-sending');
    micBtn.textContent = '…';
    micBtn.title = 'Transcribing…';
  } else {
    micBtn.textContent = '🎙️';
    micBtn.title = 'Record voice narration (transcribed)';
  }
}

async function startVoice() {
  if (voiceBusy) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert('Microphone access denied or unavailable: ' + (e.message || e));
    return;
  }
  chunks = [];
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  try {
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mime });
  } catch (e) {
    alert('Cannot start recorder: ' + (e.message || e));
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
    return;
  }
  mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mime });
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
    mediaRecorder = null;
    if (blob.size === 0) { setMicState('idle'); voiceBusy = false; return; }
    setMicState('sending');
    try {
      const audioB64 = await blobToBase64(blob);
      await window.vflow.addVoice({ audioB64, mimeType: 'audio/webm' });
    } catch (e) {
      alert('Transcription failed: ' + (e.message || e));
    } finally {
      setMicState('idle');
      voiceBusy = false;
    }
  };
  mediaRecorder.start();
  setMicState('recording');
}

function stopVoice() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  voiceBusy = true;
  try { mediaRecorder.stop(); } catch {}
}

micBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') stopVoice();
  else startVoice();
});

// Allow dragging the frameless toolbar
document.getElementById('toolbar').style.webkitAppRegion = 'drag';
[pauseBtn, stopBtn, noteBtn, micBtn].forEach(b => b.style.webkitAppRegion = 'no-drag');
