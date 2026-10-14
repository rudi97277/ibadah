import { state, findSong, parsePlaylistItem, buildSlideSequence } from './state.js';
import { renderSlide, renderVerseJumpPills, updateBackgroundDisplay } from './render.js';
import { updateActiveDrawerItem } from './drawer.js';
import { loadAllSongs, pickRandomBackground, pickNextBackground } from './song-loader.js';
import { handleSongChangedForAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

export async function loadSong(songIdOrSpec, slideIdx = 0) {
  const parsed = parsePlaylistItem(songIdOrSpec);
  let song = findSong(parsed.songId);

  if (!song && Object.keys(state.songsData).length === 0) {
    await loadAllSongs();
    song = findSong(parsed.songId);
  }

  if (!song) {
    console.warn('Song not found:', songIdOrSpec);
    return;
  }

  state.currentPlaylistItem = songIdOrSpec;
  const newSongId = song.id || song.number || parsed.songId;
  const isNewSong = (String(state.currentSongId) !== String(newSongId));
  state.currentSongId = newSongId;
  state.currentSongNumber = song.number || state.currentSongId;
  if (isNewSong && state.appSettings.background_mode === 'random' && state.availableBackgrounds.length > 0) {
    state.currentBgImage = pickNextBackground();
    updateBackgroundDisplay();
  }
  handleSongChangedForAudio(song, isNewSong);

  const jumpNumInput = $('jump-num-input');
  if (jumpNumInput) jumpNumInput.value = song.number ? song.number : '';

  state.currentSlideSequence = buildSlideSequence(song, state.appSettings, state.fontSizeRem, parsed.verseFilter);
  if (slideIdx >= state.currentSlideSequence.length) slideIdx = Math.max(0, state.currentSlideSequence.length - 1);
  if (slideIdx < 0) slideIdx = 0;
  state.currentVerseIndex = slideIdx;

  try {
    localStorage.setItem('lagu_sion_last_song', String(state.currentPlaylistItem || state.currentSongId));
    localStorage.setItem('lagu_sion_last_slide', String(slideIdx));
  } catch (err) {
    console.warn('Failed to save last song/slide to localStorage:', err);
  }

  renderSlide(song, slideIdx);
  renderVerseJumpPills(state.currentSlideSequence, slideIdx);
  updateActiveDrawerItem(state.currentSongId);

  const statusIndicator = $('status-indicator');
  if (!statusIndicator) return;

  const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
  const playlistIdx = list.findIndex(item => {
    const sItem = String(item).trim().toLowerCase();
    const sCurr = String(state.currentPlaylistItem || '').trim().toLowerCase();
    const sId = String(state.currentSongId).trim().toLowerCase();
    const sNum = String(song.number || '').trim().toLowerCase();
    const sNumNoZero = String(parseInt(sNum) || '').toLowerCase();
    const sItemNoZero = String(parseInt(sItem) || '').toLowerCase();
    return sItem === sCurr || sItem === sId || sItem === sNum || (sItemNoZero && sItemNoZero === sNumNoZero);
  });

  const verseLabel = parsed.verseFilter ? ` (Bait ${parsed.verseFilterStr})` : '';
  if (playlistIdx !== -1) {
    const nextItem = (playlistIdx < list.length - 1) ? list[playlistIdx + 1] : null;
    let nextLabel = ' (Lagu Terakhir)';
    if (nextItem) {
      const nextParsed = parsePlaylistItem(nextItem);
      const nextSongObj = findSong(nextParsed.songId);
      const nextVLabel = nextParsed.verseFilter ? ` [Bait ${nextParsed.verseFilterStr}]` : '';
      nextLabel = nextSongObj && nextSongObj.number
        ? ` ➔ Brkt: #${nextSongObj.number}${nextVLabel}`
        : (nextSongObj ? ` ➔ Brkt: ${nextSongObj.title}${nextVLabel}` : ` ➔ Brkt: ${nextItem}`);
    }
    const songDisplayName = song.number ? `Lagu ${song.number}` : song.title;
    statusIndicator.textContent = `[Urutan ${playlistIdx + 1}/${list.length}] ${songDisplayName}${verseLabel} (${slideIdx + 1}/${state.currentSlideSequence.length || 1})${nextLabel}`;
  } else {
    statusIndicator.textContent = song.number
      ? `Lagu ${song.number} / 525${verseLabel} (${slideIdx + 1}/${state.currentSlideSequence.length || 1})`
      : `${song.title}${verseLabel} (${slideIdx + 1}/${state.currentSlideSequence.length || 1})`;
  }
}

export function nextSlide() {
  if (state.currentVerseIndex < state.currentSlideSequence.length - 1) {
    loadSong(state.currentPlaylistItem || state.currentSongId, state.currentVerseIndex + 1);
  } else {
    nextSong();
  }
}

export function prevSlide() {
  if (state.currentVerseIndex > 0) {
    loadSong(state.currentPlaylistItem || state.currentSongId, state.currentVerseIndex - 1);
  } else {
    prevSong(true);
  }
}

export function nextSong() {
  const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
  if (list.length > 0) {
    const currIdx = list.findIndex(item => {
      const sItem = String(item).trim().toLowerCase();
      const sCurr = String(state.currentPlaylistItem || '').trim().toLowerCase();
      const sId = String(state.currentSongId).trim().toLowerCase();
      const sNum = String(state.currentSongNumber || '').trim().toLowerCase();
      const sNumNoZero = String(parseInt(sNum) || '').toLowerCase();
      const sItemNoZero = String(parseInt(sItem) || '').toLowerCase();
      return sItem === sCurr || sItem === sId || sItem === sNum || (sItemNoZero && sItemNoZero === sNumNoZero);
    });

    if (currIdx !== -1 && currIdx < list.length - 1) {
      loadSong(list[currIdx + 1], 0);
      return;
    } else if (currIdx === -1) {
      loadSong(list[0], 0);
      return;
    }
  }

  const num = parseInt(state.currentSongNumber);
  if (!isNaN(num) && num < 525) {
    loadSong(num + 1, 0);
  }
}

export async function prevSong(toLastSlide = false) {
  const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
  if (list.length > 0) {
    const currIdx = list.findIndex(item => {
      const sItem = String(item).trim().toLowerCase();
      const sCurr = String(state.currentPlaylistItem || '').trim().toLowerCase();
      const sId = String(state.currentSongId).trim().toLowerCase();
      const sNum = String(state.currentSongNumber || '').trim().toLowerCase();
      const sNumNoZero = String(parseInt(sNum) || '').toLowerCase();
      const sItemNoZero = String(parseInt(sItem) || '').toLowerCase();
      return sItem === sCurr || sItem === sId || sItem === sNum || (sItemNoZero && sItemNoZero === sNumNoZero);
    });

    if (currIdx > 0) {
      const targetItem = list[currIdx - 1];
      if (toLastSlide) {
        const targetParsed = parsePlaylistItem(targetItem);
        let prevSongObj = findSong(targetParsed.songId);
        if (!prevSongObj && !isNaN(parseInt(targetParsed.songId))) {
          try {
            const resp = await fetch(`songs/${targetParsed.songId}.json`);
            if (resp.ok) {
              prevSongObj = await resp.json();
              state.songsData[targetParsed.songId] = prevSongObj;
            }
          } catch (e) {}
        }
        const prevSeq = prevSongObj ? buildSlideSequence(prevSongObj, state.appSettings, state.fontSizeRem, targetParsed.verseFilter) : [];
        loadSong(targetItem, Math.max(0, prevSeq.length - 1));
      } else {
        loadSong(targetItem, 0);
      }
      return;
    }
  }

  const num = parseInt(state.currentSongNumber);
  if (!isNaN(num) && num > 1) {
    const targetNum = num - 1;
    if (toLastSlide) {
      let prevSongObj = findSong(targetNum);
      if (!prevSongObj) {
        try {
          const resp = await fetch(`songs/${targetNum}.json`);
          if (resp.ok) {
            prevSongObj = await resp.json();
            state.songsData[targetNum] = prevSongObj;
          }
        } catch (e) {}
      }
      const prevSeq = prevSongObj ? buildSlideSequence(prevSongObj, state.appSettings, state.fontSizeRem) : [];
      loadSong(targetNum, Math.max(0, prevSeq.length - 1));
    } else {
      loadSong(targetNum, 0);
    }
  }
}
