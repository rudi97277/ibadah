import { applySettingsToUI, updateCustomSongsCount, showToast } from './render.js';
import { syncCurrentToProjector } from './projector.js';
import { parseCustomSongLyrics } from './song-utils.js';
import { loadSong } from './navigation.js';
import { renderDrawerList } from './drawer.js';

export { buildSlideSequence, parseCustomSongLyrics, getMaxLinesForFontSize, getMaxCharsForFontSize, splitVerseIntoPages, parseVerseFilter, parsePlaylistItem } from './song-utils.js';
export { addToPlaylist, removeFromPlaylist, movePlaylistItem, applyBatchPlaylistInput, clearPlaylist, updatePlaylistBadge, renderPlaylistModal } from './playlist.js';
export { loadBackgrounds, pickRandomBackground, loadAllSongs, loadCustomSongs, loadAppSettings, connectDiskFileHandle } from './song-loader.js';
export { loadSong, nextSlide, prevSlide, nextSong, prevSong } from './navigation.js';
export { updateCustomSongsCount } from './render.js';

const $ = (id) => document.getElementById(id);

export const defaultSettings = {
  font_family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  font_size_lagusion_rem: 3.4,
  text_color: "#000000",
  text_stroke_color: "#ffffff",
  text_stroke_width_px: 3.5,
  background_mode: "random",
  background_color: "#ffffff",
  background_overlay_opacity: 0.35,
  show_metadata: true,
  autohide_nav: true,
  auto_split_long_verses: true,
  refrain_interleaving: true,
  projector_font_scale: 1.0,
  worship_playlist: [],
  alkitab_playlist: []
};

export const state = {
  songsData: {},
  songsIndex: [],
  currentSongNumber: 1,
  currentSongId: 1,
  currentPlaylistItem: null,
  currentVerseIndex: 0,
  currentSlideSequence: [],
  fontSizeRem: 3.4,
  isNavAutoHiding: true,
  availableBackgrounds: [],
  currentBgImage: null,
  customSongs: [],
  currentActiveTab: 'sion',
  diskFileHandle: null,
  isProjectorConnected: false,
  isLiveBroadcasting: false,
  isAudioPlaying: false,
  appSettings: { ...defaultSettings }
};

export function findSong(idOrNum) {
  if (!idOrNum) return null;
  const strVal = String(idOrNum).trim();
  const numVal = parseInt(strVal);
  const queryLower = strVal.toLowerCase();

  const custom = state.customSongs.find(s => s.id === strVal);
  if (custom) return custom;

  if (!isNaN(numVal) && state.songsData[String(numVal)]) return state.songsData[String(numVal)];
  if (state.songsData[strVal]) return state.songsData[strVal];

  const foundTitle = Object.values(state.songsData).find(s => s.title && s.title.toLowerCase() === queryLower);
  if (foundTitle) return foundTitle;

  const partialTitle = Object.values(state.songsData).find(s => s.title && s.title.toLowerCase().includes(queryLower));
  if (partialTitle) return partialTitle;

  for (const s of Object.values(state.songsData)) {
    if (s.verses && Array.isArray(s.verses)) {
      for (const v of s.verses) {
        const lines = v.lines || (v.text ? v.text.split('\n') : []);
        for (const line of lines) {
          if (line.toLowerCase().includes(queryLower)) return s;
        }
      }
    }
  }

  for (const s of state.customSongs) {
    if (s.verses && Array.isArray(s.verses)) {
      for (const v of s.verses) {
        const lines = v.lines || (v.text ? v.text.split('\n') : []);
        for (const line of lines) {
          if (line.toLowerCase().includes(queryLower)) return s;
        }
      }
    }
  }

  return null;
}

export function getLaguSionList() {
  return Object.values(state.songsData).sort((a, b) => (a.number || 0) - (b.number || 0));
}

export async function saveAppSettings(notify = false) {
  const previousSettings = JSON.parse(JSON.stringify(state.appSettings));
  let previousLocalSettings = null;
  try {
    previousLocalSettings = localStorage.getItem('lagu_sion_settings');
  } catch (err) {
    console.warn('Could not read existing settings from localStorage:', err);
  }

  const fields = [
    ['setting-font-family', 'font_family'],
    ['setting-text-color', 'text_color'],
    ['setting-stroke-color', 'text_stroke_color'],
    ['setting-bg-mode', 'background_mode'],
    ['setting-bg-color', 'background_color']
  ];
  fields.forEach(([id, key]) => {
    const el = $(id);
    if (el?.value) state.appSettings[key] = el.value;
  });

  if ($('setting-font-size')?.value) state.appSettings.font_size_lagusion_rem = parseFloat($('setting-font-size').value);
  if ($('setting-projector-scale')?.value) state.appSettings.projector_font_scale = parseFloat($('setting-projector-scale').value);
  if ($('setting-stroke-width')?.value) state.appSettings.text_stroke_width_px = parseFloat($('setting-stroke-width').value);
  if ($('setting-bg-overlay')?.value) state.appSettings.background_overlay_opacity = parseFloat($('setting-bg-overlay').value);
  if ($('setting-show-meta')) state.appSettings.show_metadata = $('setting-show-meta').checked;
  if ($('setting-autohide-nav')) state.appSettings.autohide_nav = $('setting-autohide-nav').checked;
  if ($('setting-split-verses')) state.appSettings.auto_split_long_verses = $('setting-split-verses').checked;
  if ($('setting-interleave-ref')) state.appSettings.refrain_interleaving = $('setting-interleave-ref').checked;

  applySettingsToUI();
  if (state.currentSongNumber) loadSong(state.currentPlaylistItem || state.currentSongNumber, state.currentVerseIndex);
  syncCurrentToProjector(false);

  let localSaved = false;
  try {
    localStorage.setItem('lagu_sion_settings', JSON.stringify(state.appSettings));
    localSaved = true;
  } catch (err) {
    console.warn('Failed to save settings to localStorage:', err);
  }

  let savedToDiskFile = false;
  if (state.diskFileHandle) {
    try {
      const writable = await state.diskFileHandle.createWritable();
      await writable.write(JSON.stringify(state.appSettings, null, 2));
      await writable.close();
      savedToDiskFile = true;
    } catch (err) {
      console.warn('File handle write failed:', err);
    }
  }

  let savedToServer = false;
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.appSettings)
    });
    if (res.ok) {
      savedToServer = true;
    } else {
      console.warn('Server API /api/settings returned non-ok status:', res.status);
    }
  } catch (err) {
    console.warn('Failed to save settings to /api/settings:', err);
  }

  if (!localSaved && !savedToDiskFile && !savedToServer) {
    console.warn('All settings persistence attempts failed. Reverting to previous in-memory state.');
    state.appSettings = previousSettings;
    applySettingsToUI();
    if (previousLocalSettings !== null) {
      try { localStorage.setItem('lagu_sion_settings', previousLocalSettings); } catch (e) {}
    }
    showToast('Gagal menyimpan pengaturan.');
    return;
  }

  const status = $('settings-save-status');
  if (status) {
    if (savedToDiskFile || savedToServer) {
      status.textContent = '💾 Status: Berhasil disimpan & diperbarui langsung di file settings.json!';
      status.style.color = '#15803d';
    } else {
      status.textContent = '💾 Status: Tersimpan di browser (Jalankan server-linux / server-windows.exe untuk auto-update file settings.json)';
      status.style.color = '#0284c7';
    }
  }

  if (notify) {
    showToast((savedToDiskFile || savedToServer) ? 'Pengaturan disimpan ke settings.json' : 'Pengaturan disimpan');
  }
}

export async function saveNewCustomSong() {
  const newSongTitle = $('new-song-title');
  const newSongLyrics = $('new-song-lyrics');
  const newSongKey = $('new-song-key');
  const newSongTime = $('new-song-time');
  const newSongAuthor = $('new-song-author');
  const addSongModalBackdrop = $('add-song-modal-backdrop');
  const tabLaguTambahan = $('tab-lagu-tambahan');
  const tabLaguSion = $('tab-lagu-sion');

  const title = (newSongTitle?.value || '').trim();
  const lyrics = (newSongLyrics?.value || '').trim();
  const key = (newSongKey?.value || '').trim();
  const time = (newSongTime?.value || '').trim();
  const author = (newSongAuthor?.value || '').trim();

  if (!title) { showToast('Mohon masukkan judul lagu.'); newSongTitle?.focus(); return; }
  if (!lyrics) { showToast('Mohon masukkan lirik lagu.'); newSongLyrics?.focus(); return; }

  const verses = parseCustomSongLyrics(lyrics);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `song-${Date.now()}`;
  let finalId = slug;
  let counter = 1;
  while (state.customSongs.some(s => s.id === finalId)) {
    finalId = `${slug}-${counter++}`;
  }

  const newSong = {
    id: finalId,
    title,
    key,
    time_signature: time,
    author,
    is_custom: true,
    verses
  };

  const previousCustomSongs = [...state.customSongs];
  let previousLocalCustom = null;
  try { previousLocalCustom = localStorage.getItem('lagu_sion_custom_songs'); } catch (e) {}

  state.customSongs.push(newSong);
  updateCustomSongsCount();

  let localSaved = false;
  try {
    localStorage.setItem('lagu_sion_custom_songs', JSON.stringify(state.customSongs));
    localSaved = true;
  } catch (err) {
    console.warn('Failed to save custom songs to localStorage:', err);
  }

  let serverSaved = false;
  try {
    const res = await fetch('/api/custom_songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.customSongs)
    });
    if (res.ok) serverSaved = true;
    else console.warn('Server API /api/custom_songs returned non-ok status:', res.status);
  } catch (err) {
    console.warn('Failed to save custom songs to /api/custom_songs:', err);
  }

  if (!localSaved && !serverSaved) {
    console.warn('Failed to save new custom song to any storage. Reverting in-memory state.');
    state.customSongs = previousCustomSongs;
    updateCustomSongsCount();
    if (previousLocalCustom !== null) {
      try { localStorage.setItem('lagu_sion_custom_songs', previousLocalCustom); } catch (e) {}
    }
    showToast('Gagal menyimpan lagu ke penyimpanan.');
    return;
  }

  if (addSongModalBackdrop) addSongModalBackdrop.classList.remove('open');
  if (newSongTitle) newSongTitle.value = '';
  if (newSongKey) newSongKey.value = '';
  if (newSongTime) newSongTime.value = '';
  if (newSongAuthor) newSongAuthor.value = '';
  if (newSongLyrics) newSongLyrics.value = '';

  state.currentActiveTab = 'tambahan';
  if (tabLaguTambahan) tabLaguTambahan.classList.add('active');
  if (tabLaguSion) tabLaguSion.classList.remove('active');
  renderDrawerList('');
  loadSong(newSong.id, 0);
  showToast(`Lagu "${title}" berhasil ditambahkan!`);
}
