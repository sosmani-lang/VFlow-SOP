// Persistent local store for session token + user settings.
// Uses electron-store under the hood (encrypted at rest is not supported by
// electron-store; the token is sensitive but tenant-scoped and revocable from the web app).
const Store = require('electron-store');

const store = new Store({
  name: 'vflow-recorder',
  defaults: {
    session: null, // { session_token, tenant_id, profile_id, device_kind, paired_at }
    settings: {
      hotkeyStart: 'CommandOrControl+Shift+R',
      hotkeyNote: 'CommandOrControl+Shift+N',
      defaultCaptureKeystrokes: false,
      passwordSkipKeywords: ['password', 'login', 'sign in', 'sign-in'],
    },
  },
});

module.exports = {
  getSession: () => store.get('session'),
  setSession: (s) => store.set('session', s),
  clearSession: () => store.set('session', null),
  getSettings: () => store.get('settings'),
  setSettings: (s) => store.set('settings', s),
};
