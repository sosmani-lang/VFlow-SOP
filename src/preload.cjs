const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vflow', {
  // Pairing
  isPaired: () => ipcRenderer.invoke('vflow:isPaired'),
  pair: (code) => ipcRenderer.invoke('vflow:pair', code),
  unpair: () => ipcRenderer.invoke('vflow:unpair'),
  getSession: () => ipcRenderer.invoke('vflow:getSession'),

  // Recording
  startRecording: (opts) => ipcRenderer.invoke('vflow:startRecording', opts),
  pauseRecording: () => ipcRenderer.invoke('vflow:pauseRecording'),
  resumeRecording: () => ipcRenderer.invoke('vflow:resumeRecording'),
  stopRecording: () => ipcRenderer.invoke('vflow:stopRecording'),
  addNote: (text) => ipcRenderer.invoke('vflow:addNote', text),
  addVoice: (payload) => ipcRenderer.invoke('vflow:addVoice', payload),

  // Status updates from main → renderer
  onStatus: (cb) => {
    const listener = (_, payload) => cb(payload);
    ipcRenderer.on('vflow:status', listener);
    return () => ipcRenderer.removeListener('vflow:status', listener);
  },
});
