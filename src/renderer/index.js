/* eslint-disable no-undef */
const $ = (id) => document.getElementById(id);

async function refresh() {
  const paired = await window.vflow.isPaired();
  $('pair-view').classList.toggle('hidden', paired);
  $('ready-view').classList.toggle('hidden', !paired);
  if (paired) {
    const s = await window.vflow.getSession();
    $('paired-info').textContent = s ? `Paired (${s.device_kind}) · since ${new Date(s.paired_at).toLocaleDateString()}` : '';
  }
}

$('pair-btn').addEventListener('click', async () => {
  const code = $('code-input').value.trim();
  $('pair-msg').textContent = '';
  if (!/^\d{6}$/.test(code)) { $('pair-msg').textContent = 'Enter the 6-digit code.'; return; }
  $('pair-btn').disabled = true;
  try {
    await window.vflow.pair(code);
    $('pair-msg').textContent = 'Paired!';
    await refresh();
  } catch (e) {
    $('pair-msg').textContent = e.message || 'Pairing failed';
  } finally {
    $('pair-btn').disabled = false;
  }
});

$('capture-keys').addEventListener('change', (e) => {
  $('keys-warn').classList.toggle('hidden', !e.target.checked);
});

$('start-btn').addEventListener('click', async () => {
  const title = $('sop-title').value.trim();
  if (!title) { $('sop-title').focus(); return; }
  $('start-btn').disabled = true;
  try {
    await window.vflow.startRecording({
      title,
      description: $('sop-desc').value.trim() || null,
      captureKeystrokes: $('capture-keys').checked,
    });
    // Main process hides this window after starting
  } catch (e) {
    alert(e.message || 'Could not start');
  } finally {
    $('start-btn').disabled = false;
  }
});

$('unpair-btn').addEventListener('click', async () => {
  if (!confirm('Unpair this device? You will need a new code to pair again.')) return;
  await window.vflow.unpair();
  await refresh();
});

refresh();
