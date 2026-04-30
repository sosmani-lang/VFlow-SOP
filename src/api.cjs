// Thin HTTPS client that calls the VFlow device-* edge functions.
const https = require('https');
const { URL } = require('url');

// IMPORTANT: bake the project URL into the binary. Updated on each release.
const SUPABASE_URL = 'https://pueaxbxqftkmkwuwxqmu.supabase.co';
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch (e) { resolve({ status: res.statusCode, body: { ok: false, error: 'Bad JSON', raw: chunks } }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function exchangeCode(code, deviceLabel) {
  const r = await postJson(`${FN_BASE}/device-pair-exchange`, { code, device_label: deviceLabel });
  if (!r.body?.ok) throw new Error(r.body?.error || `Pairing failed (${r.status})`);
  return r.body;
}

async function createSop(sessionToken, { title, description, accountId }) {
  const r = await postJson(`${FN_BASE}/device-session-create-sop`, {
    session_token: sessionToken,
    title,
    description,
    account_id: accountId || null,
  });
  if (!r.body?.ok) throw new Error(r.body?.error || `Create SOP failed (${r.status})`);
  return r.body;
}

async function writeStep(sessionToken, sopId, step) {
  const r = await postJson(`${FN_BASE}/device-session-write-step`, {
    session_token: sessionToken,
    sop_id: sopId,
    step,
  });
  if (!r.body?.ok) throw new Error(r.body?.error || `Write step failed (${r.status})`);
  return r.body;
}

async function transcribeAudio(sessionToken, { audioB64, mimeType }) {
  const r = await postJson(`${FN_BASE}/device-session-transcribe`, {
    session_token: sessionToken,
    audio_base64: audioB64,
    mime_type: mimeType || 'audio/webm',
  });
  if (!r.body?.ok) throw new Error(r.body?.error || `Transcribe failed (${r.status})`);
  return r.body; // { ok, transcript }
}

async function attachVoiceToStep(sessionToken, sopId, { audioB64, mimeType }) {
  const r = await postJson(`${FN_BASE}/device-session-attach-voice`, {
    session_token: sessionToken,
    sop_id: sopId,
    audio_base64: audioB64,
    mime_type: mimeType || 'audio/webm',
  });
  if (!r.body?.ok) throw new Error(r.body?.error || `Attach voice failed (${r.status})`);
  return r.body; // { ok, transcript, attached, step_id }
}

module.exports = { SUPABASE_URL, exchangeCode, createSop, writeStep, transcribeAudio, attachVoiceToStep };
