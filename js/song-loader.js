import { state, defaultSettings } from './state.js';
import { applySettingsToUI, showToast } from './render.js';
import { saveAppSettings } from './state.js';

const $ = (id) => document.getElementById(id);

export async function loadBackgrounds() {
  try {
    const res = await fetch('/api/backgrounds', { cache: 'no-store' });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) state.availableBackgrounds = list;
    }
  } catch (err) {
    console.warn('Could not fetch backgrounds from /api/backgrounds:', err);
  }
}

export function pickRandomBackground() {
  if (state.availableBackgrounds && state.availableBackgrounds.length > 0) {
    const randomIndex = Math.floor(Math.random() * state.availableBackgrounds.length);
    return state.availableBackgrounds[randomIndex];
  }
  return null;
}

export async function loadAllSongs() {
  try {
    const res = await fetch('all_songs.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.songsData = await res.json();
    state.songsIndex = Object.values(state.songsData).map(s => ({
      id: String(s.number || s.id),
      number: s.number,
      title: s.title,
      versesCount: s.verses ? s.verses.length : 0
    }));
  } catch (err) {
    console.error('Gagal memuat all_songs.json:', err);
  }
}

export async function loadCustomSongs() {
  try {
    const res = await fetch('/api/custom_songs', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        state.customSongs = data;
        return;
      }
    }
  } catch (err) {
    console.warn('Could not fetch custom songs from /api/custom_songs:', err);
  }

  try {
    const localStr = localStorage.getItem('lagu_sion_custom_songs');
    if (localStr) {
      const parsed = JSON.parse(localStr);
      if (Array.isArray(parsed)) state.customSongs = parsed;
    }
  } catch (err) {
    console.warn('Could not read custom songs from localStorage:', err);
  }
}

export async function loadAppSettings() {
  const fallbackSettings = { ...state.appSettings };
  let loaded = null;

  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    if (res.ok) {
      const apiData = await res.json();
      if (apiData && Object.keys(apiData).length > 0) loaded = apiData;
    }
  } catch (err) {
    console.warn('Could not read settings from /api/settings:', err);
  }

  if (!loaded || (!loaded.font_size_lagusion_rem && !loaded.font_size_rem)) {
    try {
      const res = await fetch('settings.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const fileData = await res.json();
        if (fileData && Object.keys(fileData).length > 0) loaded = fileData;
      }
    } catch (err) {
      console.warn('Could not read settings from settings.json:', err);
    }
  }

  if (!loaded || Object.keys(loaded).length === 0) {
    try {
      const localStr = localStorage.getItem('lagu_sion_settings');
      if (localStr) loaded = JSON.parse(localStr);
    } catch (err) {
      console.warn('Could not read settings from localStorage:', err);
    }
  }

  state.appSettings = { ...defaultSettings, ...(loaded || fallbackSettings) };
  applySettingsToUI();
}

export async function connectDiskFileHandle() {
  const settingsSaveStatus = $('settings-save-status');
  const btnConnectFile = $('btn-connect-file');

  if (!('showOpenFilePicker' in window)) {
    showToast('Browser ini belum mendukung File System Access API langsung');
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'JSON Settings File',
        accept: { 'application/json': ['.json'] }
      }],
      multiple: false
    });

    if (handle) {
      state.diskFileHandle = handle;
      const file = await state.diskFileHandle.getFile();
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        state.appSettings = { ...defaultSettings, ...parsed };
        applySettingsToUI();
      } catch (err) {
        console.warn('Failed to parse settings JSON from connected file:', err);
      }

      if (settingsSaveStatus) {
        settingsSaveStatus.textContent = `💾 Terhubung ke file: ${file.name} (Auto-update aktif!)`;
        settingsSaveStatus.style.color = '#15803d';
      }
      if (btnConnectFile) btnConnectFile.textContent = '✅ Terhubung ke ' + file.name;
      showToast('File settings.json terhubung!');
      saveAppSettings(true);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('File connection error:', err);
    }
  }
}
