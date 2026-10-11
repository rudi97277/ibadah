import { prevSlide, nextSlide, prevSong, nextSong } from './navigation.js';
import { toggleLiveBroadcast, syncCurrentToProjector } from './projector.js';
import { openDrawer, closeDrawer } from './drawer.js';
import { renderPlaylistModal } from './playlist.js';
import { hideToolbarsImmediately } from './toolbar.js';

const $ = (id) => document.getElementById(id);

export function setupKeyboardShortcuts() {
  const toggleBlank = () => {
    const blank = $('blank-screen');
    if (blank) {
      blank.classList.toggle('active');
      setTimeout(() => syncCurrentToProjector(true), 50);
    }
  };

  const keyMap = {
    ArrowRight: nextSlide, ' ': nextSlide, PageDown: nextSlide, ArrowDown: nextSlide,
    ArrowLeft: prevSlide, PageUp: prevSlide, ArrowUp: prevSlide,
    n: nextSong, N: nextSong, p: prevSong, P: prevSong,
    F5: toggleLiveBroadcast, Enter: toggleLiveBroadcast,
    b: toggleBlank, B: toggleBlank, '.': toggleBlank,
    '+': () => $('btn-font-inc')?.click(), '=': () => $('btn-font-inc')?.click(),
    '-': () => $('btn-font-dec')?.click(), '_': () => $('btn-font-dec')?.click()
  };

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
        closeDrawer();
        $('playlist-modal-backdrop')?.classList.remove('open');
        $('settings-modal-backdrop')?.classList.remove('open');
        $('add-song-modal-backdrop')?.classList.remove('open');
      }
      return;
    }

    if (e.key === 'm' || e.key === 'M' || e.key === '/') {
      e.preventDefault();
      if ($('drawer')?.classList.contains('open')) closeDrawer();
      else openDrawer();
      return;
    }

    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      if ($('playlist-modal-backdrop')?.classList.contains('open')) {
        $('playlist-modal-backdrop').classList.remove('open');
      } else if ($('playlist-modal-backdrop') && $('playlist-batch-input')) {
        renderPlaylistModal(true);
        $('playlist-modal-backdrop').classList.add('open');
        setTimeout(() => $('playlist-batch-input')?.focus(), 150);
      }
      return;
    }

    if (e.key === 'Escape') {
      closeDrawer();
      $('playlist-modal-backdrop')?.classList.remove('open');
      $('settings-modal-backdrop')?.classList.remove('open');
      $('add-song-modal-backdrop')?.classList.remove('open');
      $('blank-screen')?.classList.remove('active');
      return;
    }

    const action = keyMap[e.key];
    if (action) {
      if (['ArrowRight', ' ', 'PageDown', 'ArrowDown', 'ArrowLeft', 'PageUp', 'ArrowUp', 'F5', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }
      action();
    }
  });
}
