import { state, findSong } from './state.js';
import { showToast } from './render.js';

const $ = (id) => document.getElementById(id);


// piano or instrumental
const folder = 'instrumental';

let audioPlayer = null;
let currentLoadedSongId = null;
let lastErrorTime = 0;

function notifyAudioError(num) {
  const now = Date.now();
  if (now - lastErrorTime > 1500) {
    lastErrorTime = now;
    showToast(`Instrumental lagu ${num} belum tersedia`);
  }
}

export function getAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.preload = 'metadata';

    audioPlayer.addEventListener('ended', () => {
      state.isAudioPlaying = false;
      if (audioPlayer) audioPlayer.currentTime = 0;
      updateAudioToggleUI();
    });

    audioPlayer.addEventListener('error', () => {
      if (state.isAudioPlaying) {
        state.isAudioPlaying = false;
        updateAudioToggleUI();
        const num = state.currentSongNumber || state.currentSongId;
        notifyAudioError(num);
      }
    });
  }
  return audioPlayer;
}

export function updateAudioToggleUI() {
  const btn = $('btn-audio-toggle');
  if (!btn) return;
  if (state.isAudioPlaying) {
    btn.textContent = '⏸ Pause';
    btn.style.color = '#ffffff';
    btn.style.background = '#2563eb';
    btn.style.borderColor = '#1d4ed8';
    btn.title = 'Jeda Musik Instrumental';
  } else {
    btn.textContent = '▶ Play';
    btn.style.color = '#2563eb';
    btn.style.background = '#eff6ff';
    btn.style.borderColor = '#bfdbfe';
    btn.title = 'Putar Musik Instrumental';
  }
}

export function getSongAudioSrc(song) {
  if (!song) return null;
  const num = parseInt(song.number || song.id, 10);
  if (!isNaN(num) && num > 0) {
    return `audio/${folder}/${num}.mp3`;
  }
  const customSrc = (song.audio && song.audio.instrumental) || song.instrumental;
  if (customSrc) {
    if (customSrc.startsWith('http://') || customSrc.startsWith('https://') || customSrc.startsWith('/') || customSrc.startsWith('audio/')) {
      return customSrc;
    }
    return `audio/${folder}/${customSrc}`;
  }
  return null;
}

export async function toggleAudioPlayback() {
  const player = getAudioPlayer();
  const currentSong = findSong(state.currentSongNumber || state.currentSongId);

  if (state.isAudioPlaying) {
    player.pause();
    state.isAudioPlaying = false;
    updateAudioToggleUI();
    return;
  }

  // User wants to play
  const targetSrc = getSongAudioSrc(currentSong);
  if (!targetSrc) {
    showToast('Musik instrumental tidak tersedia untuk lagu ini');
    return;
  }

  const sId = String(currentSong?.id || currentSong?.number || state.currentSongId);
  if (currentLoadedSongId !== sId) {
    player.src = targetSrc;
    player.currentTime = 0;
    currentLoadedSongId = sId;
  }

  try {
    state.isAudioPlaying = true;
    updateAudioToggleUI();
    await player.play();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Playback error:', err);
      state.isAudioPlaying = false;
      updateAudioToggleUI();
      const num = currentSong?.number || currentSong?.id || state.currentSongNumber;
      notifyAudioError(num);
    }
  }
}

export function handleSongChangedForAudio(newSong, isNewSong) {
  const player = getAudioPlayer();
  const sId = String(newSong?.id || newSong?.number || state.currentSongId);

  // If this is the exact same song and already initialized, keep current playback uninterrupted
  if (!isNewSong && currentLoadedSongId === sId) {
    return;
  }

  // A different song is being loaded
  // 1. Stop previous audio playback completely
  player.pause();
  player.currentTime = 0;

  const targetSrc = getSongAudioSrc(newSong);
  currentLoadedSongId = sId;

  if (!targetSrc) {
    if (state.isAudioPlaying) {
      state.isAudioPlaying = false;
      updateAudioToggleUI();
      showToast('Lagu ini tidak memiliki file instrumental');
    }
    player.removeAttribute('src');
    return;
  }

  player.src = targetSrc;

  // 2. Ketika status tombol masih play, langsung play lagunya
  if (state.isAudioPlaying) {
    updateAudioToggleUI();
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Playback error on new song:', err);
          state.isAudioPlaying = false;
          updateAudioToggleUI();
          const num = newSong?.number || newSong?.id || state.currentSongNumber;
          notifyAudioError(num);
        }
      });
    }
  } else {
    updateAudioToggleUI();
  }
}
