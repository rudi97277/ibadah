import { state, findSong, saveAppSettings, loadSong, parsePlaylistItem } from './state.js';
import { escapeHtml, showToast } from './render.js';

const $ = (id) => document.getElementById(id);

export function updatePlaylistBadge() {
  const badge = $('playlist-count-badge');
  if (!badge) return;
  const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
  if (list.length > 0) {
    badge.textContent = list.length;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

export function renderPlaylistModal() {
  const container = $('playlist-items-container');
  const hint = $('playlist-status-hint');
  const batchInput = $('playlist-batch-input');
  const backdrop = $('playlist-modal-backdrop');
  if (!container) return;

  container.innerHTML = '';
  const list = Array.isArray(state.appSettings.worship_playlist) ? state.appSettings.worship_playlist : [];
  updatePlaylistBadge();

  if (list.length === 0) {
    if (hint) hint.textContent = '0 lagu terdaftar';
    if (batchInput) batchInput.value = '';
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
        🎵 <b>Belum ada lagu dalam urutan ibadah.</b><br>
        Ketik nomor lagu di atas (misal: <code>322:1, 223, 73:2</code>) lalu klik <b>Set Urutan</b>,<br>
        atau klik tombol <b>➕ Antrean</b> di menu <b>Daftar Lagu</b>.
      </div>
    `;
    return;
  }

  if (hint) hint.textContent = `${list.length} lagu dalam antrean`;
  if (batchInput) batchInput.value = list.join(', ');

  list.forEach((item, idx) => {
    const parsed = parsePlaylistItem(item);
    const song = findSong(parsed.songId) || { id: parsed.songId, number: parseInt(parsed.songId) || null, title: `Lagu ${parsed.songId}` };
    const itemDiv = document.createElement('div');
    itemDiv.className = 'playlist-item';
    const isPlaying = (String(state.currentPlaylistItem || state.currentSongId) === String(item) || String(state.currentSongNumber) === String(item));
    if (isPlaying) itemDiv.classList.add('active');

    const infoDiv = document.createElement('div');
    infoDiv.className = 'playlist-item-info';
    infoDiv.title = 'Klik untuk langsung membuka lagu ini';
    
    const labelPrefix = (song && song.number) ? `<b>#${String(song.number).padStart(3, '0')}</b>` : `<b>🎵</b>`;
    const verseSuffix = parsed.verseFilter
      ? `<span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">Bait ${parsed.verseFilterStr}</span>`
      : '';

    infoDiv.innerHTML = `
      <span class="playlist-item-num">${idx + 1}.</span>
      <span class="playlist-item-title">${labelPrefix} ${escapeHtml(song.title || '')} ${verseSuffix}</span>
      ${isPlaying ? '<span class="playlist-badge-active">▶ Sedang Tayang</span>' : ''}
    `;
    infoDiv.addEventListener('click', () => {
      loadSong(item, 0);
      if (backdrop) backdrop.classList.remove('open');
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'playlist-item-actions';

    const btnUp = document.createElement('button');
    btnUp.className = 'btn btn-sm';
    btnUp.textContent = '▲';
    btnUp.title = 'Pindahkan urutan ke atas';
    btnUp.disabled = (idx === 0);
    btnUp.addEventListener('click', (e) => { e.stopPropagation(); movePlaylistItem(idx, -1); });

    const btnDown = document.createElement('button');
    btnDown.className = 'btn btn-sm';
    btnDown.textContent = '▼';
    btnDown.title = 'Pindahkan urutan ke bawah';
    btnDown.disabled = (idx === list.length - 1);
    btnDown.addEventListener('click', (e) => { e.stopPropagation(); movePlaylistItem(idx, 1); });

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sm';
    btnDel.textContent = '✕';
    btnDel.title = 'Hapus lagu dari urutan';
    btnDel.style.color = '#dc2626';
    btnDel.addEventListener('click', (e) => { e.stopPropagation(); removeFromPlaylist(idx); });

    actionsDiv.append(btnUp, btnDown, btnDel);
    itemDiv.append(infoDiv, actionsDiv);
    container.appendChild(itemDiv);
  });
}

export function addToPlaylist(idOrNum) {
  if (!idOrNum) return;
  const parsed = parsePlaylistItem(idOrNum);
  const song = findSong(parsed.songId);
  if (!song && isNaN(parseInt(parsed.songId))) return;

  if (!Array.isArray(state.appSettings.worship_playlist)) {
    state.appSettings.worship_playlist = [];
  }
  const itemVal = (song && song.is_custom)
    ? (parsed.verseFilter ? `${song.id}:${parsed.verseFilterStr}` : song.id)
    : (parsed.verseFilter ? `${parseInt(parsed.songId) || parsed.songId}:${parsed.verseFilterStr}` : (parseInt(idOrNum) || idOrNum));
  
  state.appSettings.worship_playlist.push(itemVal);
  saveAppSettings(false);
  updatePlaylistBadge();
  const backdrop = $('playlist-modal-backdrop');
  if (backdrop && backdrop.classList.contains('open')) {
    renderPlaylistModal();
  }
  const title = song ? song.title : `Lagu ${itemVal}`;
  showToast(`"${title}" ditambahkan ke urutan ibadah`);
}

export function removeFromPlaylist(idx) {
  if (!Array.isArray(state.appSettings.worship_playlist)) return;
  state.appSettings.worship_playlist.splice(idx, 1);
  saveAppSettings(false);
  renderPlaylistModal();
  updatePlaylistBadge();
}

export function movePlaylistItem(idx, direction) {
  if (!Array.isArray(state.appSettings.worship_playlist)) return;
  const list = state.appSettings.worship_playlist;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= list.length) return;
  const temp = list[idx];
  list[idx] = list[newIdx];
  list[newIdx] = temp;
  saveAppSettings(false);
  renderPlaylistModal();
}

export function applyBatchPlaylistInput(str) {
  if (!str) str = '';
  const tokens = str.split(/[,\s]+/).map(t => t.trim()).filter(t => t.length > 0);
  const validItems = [];
  tokens.forEach(tok => {
    const parsed = parsePlaylistItem(tok);
    const num = parseInt(parsed.songId);
    if (!isNaN(num) && num >= 1 && num <= 525) {
      if (parsed.verseFilter && parsed.verseFilter.length > 0) {
        validItems.push(`${num}:${parsed.verseFilterStr}`);
      } else {
        validItems.push(num);
      }
    } else {
      const found = findSong(parsed.songId);
      if (found) {
        const id = found.id || parsed.songId;
        if (parsed.verseFilter && parsed.verseFilter.length > 0) {
          validItems.push(`${id}:${parsed.verseFilterStr}`);
        } else {
          validItems.push(id);
        }
      }
    }
  });

  state.appSettings.worship_playlist = validItems;
  saveAppSettings(false);
  renderPlaylistModal();
  updatePlaylistBadge();
  showToast(`Urutan ibadah diperbarui (${state.appSettings.worship_playlist.length} lagu)`);
}

export function clearPlaylist() {
  state.appSettings.worship_playlist = [];
  saveAppSettings(false);
  renderPlaylistModal();
  updatePlaylistBadge();
  showToast('Urutan ibadah dikosongkan');
}
