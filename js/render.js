import { state, getLaguSionList, buildFullSongSequence } from './state.js';
import { syncCurrentToProjector } from './projector.js';
import { loadSong } from './navigation.js';
import { updatePlaylistBadge } from './playlist.js';

export { updatePlaylistBadge, renderPlaylistModal } from './playlist.js';

const $ = (id) => document.getElementById(id);

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

export function updateProjectorStatusUI() {
  const dot = $('projector-status-dot');
  if (dot) {
    dot.style.background = state.isProjectorConnected ? '#22c55e' : '#94a3b8';
    dot.title = state.isProjectorConnected ? 'Layar Proyektor Terhubung (Monitor 2)' : 'Layar Proyektor Belum Terbuka';
  }
}

export function updateLiveToggleUI() {
  const btn = $('btn-live-toggle');
  if (!btn) return;
  if (state.isLiveBroadcasting) {
    btn.textContent = '⏹ Stop Tayang';
    btn.style.color = '#ffffff';
    btn.style.background = '#dc2626';
    btn.style.borderColor = '#dc2626';
    btn.title = 'Hentikan Siaran ke Layar Proyektor (F5 / Enter)';
  } else {
    btn.textContent = '▶ Tayangkan';
    btn.style.color = '#16a34a';
    btn.style.background = '#f0fdf4';
    btn.style.borderColor = '#86efac';
    btn.title = 'Tayangkan ke Layar Proyektor (F5 / Enter)';
  }
}

export function updateBackgroundDisplay() {
  const isRandom = (state.appSettings.background_mode === 'random' && state.availableBackgrounds.length > 0);
  const bgColor = state.appSettings.background_color || '#ffffff';
  document.documentElement.style.setProperty('--slide-bg-color', bgColor);

  if (isRandom) {
    if (!state.currentBgImage && state.availableBackgrounds.length > 0) {
      state.currentBgImage = state.availableBackgrounds[Math.floor(Math.random() * state.availableBackgrounds.length)];
    }
    if (state.currentBgImage) {
      document.documentElement.style.setProperty('--slide-bg-image', `url("${state.currentBgImage}")`);
      document.documentElement.style.setProperty('--bg-overlay-display', 'block');
    } else {
      document.documentElement.style.setProperty('--slide-bg-image', 'none');
      document.documentElement.style.setProperty('--bg-overlay-display', 'none');
    }
  } else {
    document.documentElement.style.setProperty('--slide-bg-image', 'none');
    document.documentElement.style.setProperty('--bg-overlay-display', 'none');
  }

  const rowBgColor = $('row-bg-color');
  const rowBgOverlay = $('row-bg-overlay');
  if (rowBgColor) rowBgColor.style.display = (state.appSettings.background_mode === 'solid') ? 'flex' : 'none';
  if (rowBgOverlay) rowBgOverlay.style.display = (state.appSettings.background_mode === 'random') ? 'flex' : 'none';
}

export function updateCustomSongsCount() {
  const countLaguTambahan = $('count-lagu-tambahan');
  const countLaguSion = $('count-lagu-sion');
  if (countLaguTambahan) countLaguTambahan.textContent = state.customSongs.length;
  const sionCount = Object.keys(state.songsData).length || 525;
  if (countLaguSion) countLaguSion.textContent = sionCount;
}

export function applySettingsToUI() {
  const s = state.appSettings;
  document.body.style.fontFamily = s.font_family;
  if ($('setting-font-family')) $('setting-font-family').value = s.font_family;

  state.fontSizeRem = parseFloat(s.font_size_lagusion_rem || s.font_size_rem) || 3.4;
  if ($('disp-lyrics')) $('disp-lyrics').style.fontSize = `${state.fontSizeRem}rem`;
  document.documentElement.style.setProperty('--full-verse-font-size', `${state.fontSizeRem}rem`);
  document.querySelectorAll('.full-verse-lines').forEach(el => {
    el.style.fontSize = `${state.fontSizeRem}rem`;
  });
  if ($('setting-font-size')) $('setting-font-size').value = state.fontSizeRem;
  if ($('font-size-val')) $('font-size-val').textContent = `${state.fontSizeRem.toFixed(1)}rem`;

  const textColor = s.text_color || '#000000';
  const strokeColor = s.text_stroke_color || '#ffffff';
  const strokeWidth = (s.text_stroke_width_px !== undefined) ? s.text_stroke_width_px : 3.5;
  const bgColor = s.background_color || '#ffffff';
  const bgOverlay = (s.background_overlay_opacity !== undefined) ? s.background_overlay_opacity : 0.35;

  document.documentElement.style.setProperty('--lyrics-text-color', textColor);
  document.documentElement.style.setProperty('--lyrics-stroke-color', strokeColor);
  document.documentElement.style.setProperty('--lyrics-stroke-width', `${strokeWidth}px`);
  document.documentElement.style.setProperty('--bg-overlay-opacity', bgOverlay);

  const valMap = {
    'setting-text-color': textColor,
    'setting-stroke-color': strokeColor,
    'setting-stroke-width': strokeWidth,
    'stroke-width-val': `${strokeWidth}px`,
    'setting-bg-mode': s.background_mode || 'random',
    'setting-bg-color': bgColor,
    'bg-color-val': bgColor,
    'setting-bg-overlay': bgOverlay,
    'bg-overlay-val': `${Math.round(bgOverlay * 100)}%`
  };
  Object.entries(valMap).forEach(([id, val]) => {
    const el = $(id);
    if (!el) return;
    if ('value' in el && el.tagName !== 'SPAN') el.value = val;
    else el.textContent = val;
  });

  updateBackgroundDisplay();

  const checkMap = {
    'setting-show-meta': s.show_metadata !== false,
    'setting-autohide-nav': s.autohide_nav !== false,
    'setting-split-verses': s.auto_split_long_verses !== false,
    'setting-interleave-ref': s.refrain_interleaving !== false
  };
  Object.entries(checkMap).forEach(([id, val]) => { if ($(id)) $(id).checked = val; });
  if ($('disp-meta')) $('disp-meta').style.display = checkMap['setting-show-meta'] ? 'flex' : 'none';
  if ($('full-disp-meta')) $('full-disp-meta').style.display = checkMap['setting-show-meta'] ? 'flex' : 'none';
  state.isNavAutoHiding = checkMap['setting-autohide-nav'];

  updatePlaylistBadge();
}

export function renderSlide(song, slideIdx) {
  const dispTitle = $('disp-title');
  const dispKey = $('disp-key');
  const dispTime = $('disp-time');
  const dispVerseBadge = $('disp-verse-badge');
  const dispLyrics = $('disp-lyrics');

  const titleText = (song && song.number)
    ? `${String(song.number).padStart(3, '0')} ${song.title.toUpperCase()}`
    : (song ? song.title.toUpperCase() : '');
  if (dispTitle) dispTitle.textContent = titleText;

  if (dispKey) {
    dispKey.style.display = (song && song.key) ? 'inline-block' : 'none';
    dispKey.textContent = (song && song.key) ? `Nada: ${song.key}` : '';
  }

  if (dispTime) {
    dispTime.style.display = (song && song.time_signature) ? 'inline-block' : 'none';
    dispTime.textContent = (song && song.time_signature) ? `Ketukan: ${song.time_signature}` : '';
  }

  if (state.currentSlideSequence.length > 0 && state.currentSlideSequence[slideIdx]) {
    const slide = state.currentSlideSequence[slideIdx];
    const badgeText = slide.displayLabel || slide.label || '1/1';
    if (dispVerseBadge) {
      dispVerseBadge.textContent = badgeText;
      dispVerseBadge.classList.toggle('chorus', !!(slide.isChorus || slide.type === 'chorus' || badgeText.toLowerCase().includes('ref')));
    }
    if (dispLyrics) {
      dispLyrics.textContent = slide.lines ? slide.lines.join('\n') : (slide.text || '');
    }
  } else {
    if (dispVerseBadge) {
      dispVerseBadge.textContent = '1/1';
      dispVerseBadge.classList.remove('chorus');
    }
    if (dispLyrics) dispLyrics.textContent = '-';
  }

  syncCurrentToProjector(false);
}

export function renderFullSong(song, verseFilter = null) {
  const fullDispTitle = $('full-disp-title');
  const fullDispKey = $('full-disp-key');
  const fullDispTime = $('full-disp-time');
  const fullDispAuthor = $('full-disp-author');
  const fullVersesList = $('full-verses-list');

  const titleText = (song && song.number)
    ? `${String(song.number).padStart(3, '0')} ${song.title.toUpperCase()}`
    : (song ? song.title.toUpperCase() : '');
  if (fullDispTitle) fullDispTitle.textContent = titleText;

  if (fullDispKey) {
    fullDispKey.textContent = (song && song.key) ? `Nada: ${song.key}` : '';
    fullDispKey.style.display = (song && song.key) ? 'inline-block' : 'none';
  }
  if (fullDispTime) {
    fullDispTime.textContent = (song && song.time_signature) ? `Ketukan: ${song.time_signature}` : '';
    fullDispTime.style.display = (song && song.time_signature) ? 'inline-block' : 'none';
  }
  if (fullDispAuthor) {
    fullDispAuthor.textContent = (song && song.author) ? song.author : ((song && song.original_title) || '');
    fullDispAuthor.style.display = (song && (song.author || song.original_title)) ? 'inline-block' : 'none';
  }

  if (!fullVersesList) return;
  fullVersesList.innerHTML = '';
  const itemsToRender = buildFullSongSequence(song, state.appSettings, verseFilter);

  itemsToRender.forEach((v, idx) => {
    const block = document.createElement('div');
    block.className = 'full-verse-block';

    const label = document.createElement('div');
    label.className = 'full-verse-label';
    if (v.isChorus) label.classList.add('chorus');
    label.textContent = v.displayLabel || v.label || (v.isChorus ? 'Refrein' : `${idx + 1}`);

    const lines = document.createElement('div');
    lines.className = 'full-verse-lines';
    lines.style.fontSize = `${state.fontSizeRem}rem`;
    lines.textContent = v.lines ? v.lines.join('\n') : (v.text || '');

    block.append(label, lines);
    fullVersesList.appendChild(block);
  });
}

export function renderVerseJumpPills(sequence, currentIdx) {
  const container = $('verse-jump-buttons');
  if (!container) return;
  container.innerHTML = '';
  sequence.forEach((s, idx) => {
    const btn = document.createElement('button');
    btn.className = 'verse-btn';
    let label = s.displayLabel || s.label || `${idx + 1}`;
    if (s.isChorus || s.type === 'chorus' || label.toLowerCase().includes('ref')) {
      btn.classList.add('is-chorus');
      label = 'Ref';
    } else {
      const m = label.match(/^(\d+)/i);
      if (m) label = m[1];
    }

    btn.textContent = label;
    if (idx === currentIdx) btn.classList.add('active');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSong(state.currentSongId, idx);
    });
    container.appendChild(btn);
  });
}
