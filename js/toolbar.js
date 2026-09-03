const $ = (id) => document.getElementById(id);
let suppressHoverUntilMove = false;

export function hideToolbarsImmediately() {
  if (document.activeElement) document.activeElement.blur();
  $('top-toolbar')?.classList.remove('show');
  $('top-toolbar')?.classList.add('force-hide');
  $('bottom-toolbar')?.classList.remove('show');
  $('bottom-toolbar')?.classList.remove('force-hide');
  suppressHoverUntilMove = true;

  setTimeout(() => {
    $('top-toolbar')?.classList.remove('force-hide');
    $('bottom-toolbar')?.classList.remove('force-hide');
    suppressHoverUntilMove = false;
  }, 1200);
}

export function startAutoHideTimer() {
  const topToolbar = $('top-toolbar');
  const bottomToolbar = $('bottom-toolbar');
  const jumpNumInput = $('jump-num-input');

  const checkOverlayOpen = () =>
    $('drawer')?.classList.contains('open') ||
    $('settings-modal-backdrop')?.classList.contains('open') ||
    $('playlist-modal-backdrop')?.classList.contains('open') ||
    $('add-song-modal-backdrop')?.classList.contains('open');

  window.addEventListener('mousemove', (e) => {
    if (suppressHoverUntilMove) {
      topToolbar?.classList.remove('force-hide');
      bottomToolbar?.classList.remove('force-hide');
      suppressHoverUntilMove = false;
    }

    if (checkOverlayOpen()) {
      topToolbar?.classList.add('show');
      bottomToolbar?.classList.add('show');
      return;
    }

    const isJumpInputFocused = (document.activeElement === jumpNumInput);

    if (e.clientY <= 65) {
      topToolbar?.classList.add('show');
    } else if (topToolbar && !topToolbar.matches(':hover') && !isJumpInputFocused) {
      topToolbar.classList.remove('show');
    }

    if (e.clientY >= window.innerHeight - 60) {
      bottomToolbar?.classList.add('show');
    } else if (bottomToolbar && !bottomToolbar.matches(':hover')) {
      bottomToolbar.classList.remove('show');
    }
  });

  document.addEventListener('mouseleave', () => {
    if (!checkOverlayOpen()) {
      topToolbar?.classList.remove('show');
      bottomToolbar?.classList.remove('show');
    }
  });

  document.addEventListener('mouseup', (e) => {
    const btn = e.target.closest('button');
    if (btn) setTimeout(() => btn.blur(), 50);
  });

  document.addEventListener('fullscreenchange', hideToolbarsImmediately);
}
