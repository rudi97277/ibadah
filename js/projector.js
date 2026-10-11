import { state, findSong } from './state.js';
import { showToast, updateLiveToggleUI, updateProjectorStatusUI } from './render.js';

export let projectorWindow = null;
export const projectorChannel = new BroadcastChannel('lagusion_live_bus');

export async function openProjectorWindow() {
  if (!projectorWindow || projectorWindow.closed) {
    let opened = false;
    if ('getScreenDetails' in window && typeof window.getScreenDetails === 'function') {
      try {
        const details = await window.getScreenDetails();
        const targetScreen = (details && details.screens) ? (details.screens.find(s => !s.isPrimary) || details.screens[0]) : null;
        if (targetScreen) {
          const features = `left=${targetScreen.left},top=${targetScreen.top},width=${targetScreen.width},height=${targetScreen.height},menubar=no,toolbar=no,location=no`;
          projectorWindow = window.open('display.html', 'LaguSionProjector', features);
          opened = true;
        }
      } catch (err) {
        console.warn('Window Management API getScreenDetails unavailable or denied:', err);
      }
    }

    if (!opened) {
      projectorWindow = window.open('display.html', 'LaguSionProjector', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
    }

    if (projectorWindow) {
      const tryFullscreen = () => {
        try {
          if (projectorWindow.document && projectorWindow.document.documentElement) {
            projectorWindow.document.documentElement.requestFullscreen().catch(err => {
              console.warn('Auto-fullscreen request rejected:', err);
            });
          }
        } catch (err) {
          console.warn('Auto-fullscreen request error:', err);
        }
      };

      projectorWindow.addEventListener('load', tryFullscreen);
      if (projectorWindow.document && projectorWindow.document.readyState === 'complete') {
        tryFullscreen();
      }
    }
  } else {
    projectorWindow.focus();
  }

  if (state.isLiveBroadcasting) {
    setTimeout(() => syncCurrentToProjector(true), 300);
  }
}

export function toggleLiveBroadcast() {
  state.isLiveBroadcasting = !state.isLiveBroadcasting;
  updateLiveToggleUI();
  if (state.isLiveBroadcasting) {
    syncCurrentToProjector(true);
    showToast('▶ Sedang Tayang di Proyektor');
  } else {
    const standbyState = { mode: 'standby' };
    try {
      localStorage.setItem('lagusion_live_state', JSON.stringify(standbyState));
    } catch (e) {}
    projectorChannel.postMessage({ type: 'DISPLAY_UPDATE', state: standbyState });
    showToast('⏹ Siaran Proyektor Dihentikan');
  }
}

export function syncCurrentToProjector(force = false) {
  if (!state.currentSongId) return;
  if (!state.isLiveBroadcasting && !force) return;

  const song = findSong(state.currentSongId);
  const slide = (state.currentSlideSequence && state.currentSlideSequence[state.currentVerseIndex]) ? state.currentSlideSequence[state.currentVerseIndex] : null;
  if (!song || !slide) return;

  const liveState = {
    mode: 'song',
    isBlank: false,
    title: song.number ? `${String(song.number).padStart(3, '0')} ${song.title.toUpperCase()}` : song.title.toUpperCase(),
    key: song.key || '',
    time: song.time || '',
    showMetadata: state.appSettings.show_metadata,
    verseBadge: slide.displayLabel || (song.verses ? `1/${song.verses.length}` : '1/1'),
    isChorus: !!slide.isChorus,
    lyrics: slide.text || '',
    fontSizeRem: state.fontSizeRem,
    projectorFontScale: (state.appSettings.projector_font_scale !== undefined) ? state.appSettings.projector_font_scale : 1.0,
    fontFamily: state.appSettings.font_family,
    textColor: state.appSettings.text_color || '#000000',
    strokeColor: state.appSettings.text_stroke_color || '#ffffff',
    strokeWidth: (state.appSettings.text_stroke_width_px !== undefined) ? state.appSettings.text_stroke_width_px : 3.5,
    bgColor: state.appSettings.background_color || '#ffffff',
    bgImage: (state.appSettings.background_mode === 'random' && state.currentBgImage) ? state.currentBgImage : null,
    bgOverlay: (state.appSettings.background_overlay_opacity !== undefined) ? state.appSettings.background_overlay_opacity : 0.35
  };

  try {
    localStorage.setItem('lagusion_live_state', JSON.stringify(liveState));
  } catch (e) {}
  projectorChannel.postMessage({ type: 'DISPLAY_UPDATE', state: liveState });
}

export function initProjector() {
  projectorChannel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'DISPLAY_CONNECTED' || data.type === 'DISPLAY_READY') {
      state.isProjectorConnected = true;
      updateProjectorStatusUI();
      if (state.isLiveBroadcasting) {
        syncCurrentToProjector(true);
      }
    } else if (data.type === 'REQUEST_SYNC') {
      if (state.isLiveBroadcasting) {
        syncCurrentToProjector(true);
      }
    }
  };

  projectorChannel.postMessage({ type: 'REQUEST_PING' });
}
