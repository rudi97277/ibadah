import { state, saveAppSettings, saveNewCustomSong, clearPlaylist, applyBatchPlaylistInput, loadBackgrounds, loadAppSettings, loadAllSongs, loadCustomSongs } from './state.js';
import { loadSong, prevSlide, nextSlide, prevSong, nextSong } from './navigation.js';
import { openDrawer, closeDrawer, filterSongs, renderDrawerList } from './drawer.js';
import { renderPlaylistModal, updateCustomSongsCount, showToast, updateProjectorStatusUI } from './render.js';
import { openProjectorWindow, syncCurrentToProjector, initProjector } from './projector.js';
import { hideToolbarsImmediately, startAutoHideTimer } from './toolbar.js';
import { setupKeyboardShortcuts } from './keyboard.js';
import { toggleAudioPlayback, updateAudioToggleUI } from './audio.js';

export { hideToolbarsImmediately, startAutoHideTimer } from './toolbar.js';
export { openDrawer, closeDrawer, filterSongs } from './drawer.js';

const $ = (id) => document.getElementById(id);
const on = (id, event, handler) => {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
};

export function setupEventListeners() {
  const slideViewport = $('slide-viewport');
  if (slideViewport) {
    slideViewport.addEventListener('click', (e) => {
      const rect = slideViewport.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < rect.width * 0.2) prevSlide();
      else nextSlide();
    });
  }

  const jumpNumInput = $('jump-num-input');
  if (jumpNumInput) {
    jumpNumInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        loadSong(jumpNumInput.value, 0);
        jumpNumInput.blur();
      }
    });
  }
  on('btn-jump-go', 'click', () => {
    if (jumpNumInput) loadSong(jumpNumInput.value, 0);
  });

  on('btn-prev-slide', 'click', prevSlide);
  on('btn-next-slide', 'click', nextSlide);
  on('btn-prev-song', 'click', prevSong);
  on('btn-next-song', 'click', nextSong);

  on('btn-toggle-drawer', 'click', openDrawer);
  on('btn-close-drawer', 'click', closeDrawer);
  on('drawer-backdrop', 'click', closeDrawer);
  on('song-search-input', 'input', (e) => filterSongs(e.target.value));

  on('tab-lagu-sion', 'click', () => {
    state.currentActiveTab = 'sion';
    $('tab-lagu-sion')?.classList.add('active');
    $('tab-lagu-tambahan')?.classList.remove('active');
    const input = $('song-search-input');
    if (input) {
      input.placeholder = '🔍 Cari nomor atau judul lagu...';
      filterSongs(input.value);
    }
  });

  on('tab-lagu-tambahan', 'click', () => {
    state.currentActiveTab = 'tambahan';
    $('tab-lagu-tambahan')?.classList.add('active');
    $('tab-lagu-sion')?.classList.remove('active');
    const input = $('song-search-input');
    if (input) {
      input.placeholder = '🔍 Cari judul lagu tambahan atau lirik...';
      filterSongs(input.value);
    }
  });

  const modalActions = [
    ['btn-open-add-song', () => { $('add-song-modal-backdrop')?.classList.add('open'); setTimeout(() => $('new-song-title')?.focus(), 150); }],
    ['btn-close-add-song', () => $('add-song-modal-backdrop')?.classList.remove('open')],
    ['btn-cancel-add-song', () => $('add-song-modal-backdrop')?.classList.remove('open')],
    ['btn-save-new-song', saveNewCustomSong],
    ['btn-settings', () => $('settings-modal-backdrop')?.classList.add('open')],
    ['btn-close-settings', () => $('settings-modal-backdrop')?.classList.remove('open')],
    ['btn-toggle-playlist', () => { renderPlaylistModal(true); $('playlist-modal-backdrop')?.classList.add('open'); setTimeout(() => $('playlist-batch-input')?.focus(), 150); }],
    ['btn-close-playlist', () => $('playlist-modal-backdrop')?.classList.remove('open')],
    ['btn-done-playlist', () => $('playlist-modal-backdrop')?.classList.remove('open')]
  ];
  modalActions.forEach(([id, fn]) => on(id, 'click', fn));

  ['add-song-modal-backdrop', 'settings-modal-backdrop', 'playlist-modal-backdrop'].forEach(id => {
    on(id, 'click', (e) => {
      if (e.target === $(id)) {
        if (id === 'settings-modal-backdrop') saveAppSettings(false);
        $(id).classList.remove('open');
      }
    });
  });

  const adjustFontSize = (delta) => {
    state.fontSizeRem = Math.min(8.0, Math.max(1.8, state.fontSizeRem + delta));
    if ($('disp-lyrics')) $('disp-lyrics').style.fontSize = `${state.fontSizeRem}rem`;
    if ($('setting-font-size')) $('setting-font-size').value = state.fontSizeRem;
    if ($('font-size-val')) $('font-size-val').textContent = `${state.fontSizeRem.toFixed(1)}rem`;
    saveAppSettings(false);
  };

  on('btn-font-inc', 'click', () => adjustFontSize(0.3));
  on('btn-font-dec', 'click', () => adjustFontSize(-0.3));

  on('btn-open-projector', 'click', openProjectorWindow);
  on('btn-audio-toggle', 'click', toggleAudioPlayback);

  const toggleBlank = () => {
    state.isBlank = !state.isBlank;
    syncCurrentToProjector(true);
    updateProjectorStatusUI();
    showToast(state.isBlank ? 'Layar Proyektor: BLANK' : 'Layar Proyektor: AKTIF');
  };
  on('btn-blank', 'click', toggleBlank);

  const applyPlaylist = () => {
    const input = $('playlist-batch-input');
    if (input) applyBatchPlaylistInput(input.value);
  };
  on('btn-apply-playlist-batch', 'click', applyPlaylist);
  $('playlist-batch-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      applyPlaylist();
    }
  });

  on('btn-clear-playlist', 'click', () => {
    clearPlaylist();
  });

  on('btn-start-playlist', 'click', () => {
    const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
    if (list.length > 0) {
      loadSong(list[0], 0);
      $('playlist-modal-backdrop')?.classList.remove('open');
    } else {
      showToast('Silakan masukkan nomor lagu terlebih dahulu');
    }
  });

  on('setting-font-family', 'change', () => saveAppSettings(false));
  const settingFontSize = $('setting-font-size');
  if (settingFontSize) {
    settingFontSize.addEventListener('input', (e) => {
      state.fontSizeRem = parseFloat(e.target.value);
      if ($('disp-lyrics')) $('disp-lyrics').style.fontSize = `${state.fontSizeRem}rem`;
      if ($('font-size-val')) $('font-size-val').textContent = `${state.fontSizeRem.toFixed(1)}rem`;
    });
    settingFontSize.addEventListener('change', () => saveAppSettings(false));
  }

  const settingProjectorScale = $('setting-projector-scale');
  if (settingProjectorScale) {
    settingProjectorScale.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.appSettings.projector_font_scale = val;
      if ($('projector-scale-val')) $('projector-scale-val').textContent = `${val.toFixed(2)}x`;
      syncCurrentToProjector(false);
    });
    settingProjectorScale.addEventListener('change', () => saveAppSettings(false));
  }

  const liveCssMap = [
    ['setting-text-color', '--lyrics-text-color'],
    ['setting-stroke-color', '--lyrics-stroke-color'],
    ['setting-bg-color', '--slide-bg-color']
  ];
  liveCssMap.forEach(([id, cssVar]) => {
    on(id, 'input', (e) => {
      document.documentElement.style.setProperty(cssVar, e.target.value);
      if (id === 'setting-bg-color' && $('bg-color-val')) $('bg-color-val').textContent = e.target.value;
    });
    on(id, 'change', () => saveAppSettings(false));
  });

  on('setting-stroke-width', 'input', (e) => {
    const val = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--lyrics-stroke-width', `${val}px`);
    if ($('stroke-width-val')) $('stroke-width-val').textContent = `${val}px`;
  });
  on('setting-stroke-width', 'change', () => saveAppSettings(false));

  on('setting-bg-mode', 'change', (e) => {
    state.appSettings.background_mode = e.target.value;
    saveAppSettings(false);
  });

  on('setting-bg-overlay', 'input', (e) => {
    const val = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--bg-overlay-opacity', val);
    if ($('bg-overlay-val')) $('bg-overlay-val').textContent = `${Math.round(val * 100)}%`;
  });
  on('setting-bg-overlay', 'change', () => saveAppSettings(false));

  ['setting-show-meta', 'setting-autohide-nav', 'setting-split-verses', 'setting-interleave-ref'].forEach(id => {
    on(id, 'change', () => saveAppSettings(false));
  });

  setupKeyboardShortcuts();
}

export async function init() {
  initProjector();
  await loadBackgrounds();
  await loadAppSettings();
  await loadAllSongs();
  await loadCustomSongs();

  updateCustomSongsCount();
  renderDrawerList('');

  let initialSong = 1;
  let initialSlide = 0;
  try {
    const savedSong = localStorage.getItem('lagu_sion_last_song');
    const savedSlide = localStorage.getItem('lagu_sion_last_slide');
    if (savedSong) {
      initialSong = savedSong;
      if (savedSlide !== null && !isNaN(parseInt(savedSlide))) {
        initialSlide = parseInt(savedSlide);
      }
    } else if (state.appSettings.worship_playlist && state.appSettings.worship_playlist.length > 0) {
      initialSong = state.appSettings.worship_playlist[0];
    }
  } catch (e) {}

  await loadSong(initialSong, initialSlide);
  syncCurrentToProjector(true);
  updateAudioToggleUI();
  setupEventListeners();
  startAutoHideTimer();
}
