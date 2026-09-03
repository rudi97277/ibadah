import { state, getLaguSionList } from './state.js';
import { loadSong } from './navigation.js';
import { addToPlaylist } from './playlist.js';
import { escapeHtml } from './render.js';

const $ = (id) => document.getElementById(id);
let searchDebounceTimer = null;

export function openDrawer() {
  const drawer = $('drawer');
  const backdrop = $('drawer-backdrop');
  const input = $('song-search-input');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 150);
  }
  renderDrawerList('');
}

export function closeDrawer() {
  $('drawer')?.classList.remove('open');
  $('drawer-backdrop')?.classList.remove('open');
}

export function filterSongs(query) {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => renderDrawerList(query), 150);
}

function createSongListItem(item, isCustom, matchedLine) {
  const li = document.createElement('li');
  li.className = 'song-item';
  const songId = isCustom ? item.id : item.number;
  li.dataset.songId = songId;
  if (String(state.currentSongId) === String(songId)) li.classList.add('active');

  const infoSpan = document.createElement('div');
  infoSpan.style.display = 'flex';
  infoSpan.style.flexDirection = 'column';
  infoSpan.style.flex = '1';
  infoSpan.style.overflow = 'hidden';
  infoSpan.style.cursor = 'pointer';
  const countStr = (item.verses && item.verses.length) ? `(${item.verses.length})` : '';
  const snippetHtml = matchedLine ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 36px;">"...${escapeHtml(matchedLine)}..."</div>` : '';

  const numBadge = isCustom
    ? `<span class="song-item-num" style="color: #2563eb; font-size: 16px; width: 36px;">🎵</span>`
    : `<span class="song-item-num">${String(item.number).padStart(3, '0')}</span>`;

  infoSpan.innerHTML = `
    <div style="display: flex; align-items: center; width: 100%;">
      ${numBadge}
      <span class="song-item-title" style="${isCustom ? 'font-weight: 600;' : ''}">${escapeHtml(item.title)}</span>
      <span class="song-item-verses">${countStr}</span>
    </div>
    ${snippetHtml}
  `;
  infoSpan.addEventListener('click', () => {
    loadSong(songId, 0);
    closeDrawer();
  });

  const btnAdd = document.createElement('button');
  btnAdd.className = 'btn-add-queue';
  btnAdd.textContent = '➕ Antrean';
  btnAdd.title = isCustom ? `Tambahkan "${item.title}" ke Urutan Ibadah` : `Tambahkan Lagu ${item.number} ke Urutan Ibadah`;
  btnAdd.addEventListener('click', (e) => {
    e.stopPropagation();
    addToPlaylist(songId);
  });

  li.append(infoSpan, btnAdd);
  return li;
}

export function renderDrawerList(filterText = '') {
  const songListItems = $('song-list-items');
  if (!songListItems) return;
  songListItems.innerHTML = '';
  const fragment = document.createDocumentFragment();
  filterText = (filterText || '').trim().toLowerCase();
  const isCustomTab = (state.currentActiveTab === 'tambahan');
  const sourceList = isCustomTab ? state.customSongs : getLaguSionList();

  const matched = sourceList.map(s => {
    if (!filterText) return { song: s, matchedLine: null };
    const numStr = String(s.number || '');
    const titleLower = (s.title || '').toLowerCase();
    if ((numStr && numStr.includes(filterText)) || titleLower.includes(filterText)) {
      return { song: s, matchedLine: null };
    }
    if (s.verses && Array.isArray(s.verses)) {
      for (const v of s.verses) {
        const lines = v.lines || (v.text ? v.text.split('\n') : []);
        for (const line of lines) {
          if (line.toLowerCase().includes(filterText)) return { song: s, matchedLine: line.trim() };
        }
      }
    }
    return null;
  }).filter(Boolean);

  if (matched.length === 0) {
    songListItems.innerHTML = isCustomTab ? `
      <li style="padding: 30px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.6;">
        Belum ada lagu tambahan yang cocok.<br>
        Klik tombol <b>➕ Baru</b> di atas untuk menambahkan lagu pujian.
      </li>
    ` : `
      <li style="padding: 30px 16px; text-align: center; color: #94a3b8; font-size: 13px;">
        Tidak ada lagu sion ditemukan.
      </li>
    `;
    return;
  }

  matched.forEach(({ song: item, matchedLine }) => {
    fragment.appendChild(createSongListItem(item, isCustomTab, matchedLine));
  });
  songListItems.appendChild(fragment);
}

export function updateActiveDrawerItem(songId) {
  document.querySelectorAll('.song-item').forEach(el => {
    if (String(el.dataset.songId) === String(songId)) {
      el.classList.add('active');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('active');
    }
  });
}
