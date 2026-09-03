export function getMaxLinesForFontSize(sizeRem) {
  if (sizeRem >= 5.0) return 2;
  if (sizeRem >= 4.0) return 3;
  if (sizeRem >= 2.8) return 4;
  if (sizeRem >= 2.2) return 5;
  return 6;
}

export function getMaxCharsForFontSize(sizeRem) {
  if (sizeRem >= 5.0) return 100;
  if (sizeRem >= 4.0) return 160;
  if (sizeRem >= 2.8) return 220;
  if (sizeRem >= 2.2) return 280;
  return 360;
}

export function formatSubPageLabel(baseLabel, pageIndex, totalPages) {
  if (totalPages <= 1 || !baseLabel) return baseLabel || '1/1';
  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const suffixLetter = letters[pageIndex] || String(pageIndex + 1);

  const fractionMatch = String(baseLabel).match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) return `${fractionMatch[1]}${suffixLetter}/${fractionMatch[2]}`;
  if (/^ref(rein)?$/i.test(String(baseLabel).trim())) return `${baseLabel} (${pageIndex + 1}/${totalPages})`;
  if (/^\d+$/.test(String(baseLabel).trim())) return `${baseLabel}${suffixLetter}`;
  const baitMatch = String(baseLabel).match(/^bait\s*(\d+)$/i);
  if (baitMatch) return `Bait ${baitMatch[1]}${suffixLetter}`;
  return `${baseLabel} (${pageIndex + 1}/${totalPages})`;
}

export function parseVerseFilter(str) {
  if (!str) return null;
  const cleaned = String(str).trim();
  if (!cleaned) return null;
  const result = new Set();
  const parts = cleaned.split(/[,;\s.]+/);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr);
      const end = parseInt(endStr);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) result.add(i);
      }
    } else {
      const n = parseInt(part);
      if (!isNaN(n)) result.add(n);
    }
  }
  return result.size > 0 ? Array.from(result).sort((a, b) => a - b) : null;
}

export function parsePlaylistItem(item) {
  if (item === null || item === undefined) return { raw: '', songId: '', verseFilter: null, verseFilterStr: '' };
  const str = String(item).trim();
  const colonIdx = str.indexOf(':');
  if (colonIdx === -1) {
    const num = parseInt(str);
    return { raw: item, songId: (!isNaN(num) && String(num) === str) ? num : str, verseFilter: null, verseFilterStr: '' };
  }
  const songPart = str.slice(0, colonIdx).trim();
  const versePart = str.slice(colonIdx + 1).trim();
  const num = parseInt(songPart);
  const songId = (!isNaN(num) && String(num) === songPart) ? num : songPart;
  return { raw: str, songId, verseFilter: parseVerseFilter(versePart), verseFilterStr: versePart };
}

export function splitVerseIntoPages(v, totalVersesCount = 0, sizeRem = 3.4, shouldSplit = true) {
  const lines = v.lines || (v.text ? v.text.split('\n') : []);
  if (!lines || lines.length === 0) return [];

  const maxLines = getMaxLinesForFontSize(sizeRem);
  const maxChars = getMaxCharsForFontSize(sizeRem);
  const isChorus = v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));
  const baseLabel = v.label || (isChorus ? 'Refrein' : (totalVersesCount > 0 ? `1/${totalVersesCount}` : '1'));

  const totalLines = lines.length;
  const totalChars = lines.reduce((acc, l) => acc + l.length, 0);

  if (!shouldSplit || (totalLines <= maxLines && totalChars <= maxChars)) {
    return [{ ...v, lines, text: lines.join('\n'), displayLabel: baseLabel, label: baseLabel, baseLabel, isChorus }];
  }

  let k = Math.min(Math.max(2, Math.ceil(totalLines / maxLines), Math.ceil(totalChars / maxChars)), totalLines);
  let chunks = [];

  while (k <= totalLines) {
    const b = Math.floor(totalLines / k);
    const r = totalLines % k;
    chunks = [];
    let idx = 0;
    let anyChunkExceeds = false;

    for (let i = 0; i < k; i++) {
      const chunkSize = (i < r) ? (b + 1) : b;
      const chunkLines = lines.slice(idx, idx + chunkSize);
      const chunkChars = chunkLines.reduce((acc, l) => acc + l.length, 0);
      if (chunkLines.length > maxLines || (chunkChars > maxChars && chunkLines.length > 1)) {
        anyChunkExceeds = true;
      }
      chunks.push(chunkLines);
      idx += chunkSize;
    }

    if (!anyChunkExceeds || k === totalLines) break;
    k++;
  }

  return chunks.map((chunkLines, cIdx) => {
    const subLabel = formatSubPageLabel(baseLabel, cIdx, chunks.length);
    return {
      ...v,
      displayLabel: subLabel,
      label: subLabel,
      baseLabel,
      lines: chunkLines,
      text: chunkLines.join('\n'),
      subPageIndex: cIdx,
      subPageTotal: chunks.length,
      isChorus
    };
  });
}

export function buildSlideSequence(song, settings = {}, sizeRem = 3.4, verseFilter = null) {
  const verses = song ? (song.verses || []) : [];
  if (verses.length === 0) return [];

  const autoSplit = settings.auto_split_long_verses !== false;
  const interleave = settings.refrain_interleaving !== false;
  const isChorus = (v) => v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));

  const choruses = verses.filter(isChorus);
  const allNormalVerses = verses.filter(v => !isChorus(v));

  let normalVerses = allNormalVerses;
  if (verseFilter && Array.isArray(verseFilter) && verseFilter.length > 0) {
    normalVerses = allNormalVerses.filter((v, idx) => {
      const labelMatch = v.label ? v.label.match(/^(\d+)/) : null;
      const verseNum = labelMatch ? parseInt(labelMatch[1]) : (idx + 1);
      return verseFilter.includes(verseNum);
    });
    if (normalVerses.length === 0) normalVerses = allNormalVerses;
  }

  const sequence = [];

  if (!interleave || choruses.length === 0 || normalVerses.length === 0) {
    const filteredVerses = (verseFilter && Array.isArray(verseFilter) && verseFilter.length > 0)
      ? verses.filter((v, idx) => {
          if (isChorus(v)) return true;
          const labelMatch = v.label ? v.label.match(/^(\d+)/) : null;
          const normalIdx = allNormalVerses.indexOf(v);
          const verseNum = labelMatch ? parseInt(labelMatch[1]) : (normalIdx !== -1 ? normalIdx + 1 : idx + 1);
          return verseFilter.includes(verseNum);
        })
      : verses;

    filteredVerses.forEach((v) => {
      const pages = splitVerseIntoPages(v, verses.length, sizeRem, autoSplit);
      pages.forEach(p => sequence.push({ ...p, slideIndex: sequence.length, isChorus: isChorus(v) }));
    });
    return sequence;
  }

  const mainChorus = choruses[0];
  const chorusPages = splitVerseIntoPages(mainChorus, 0, sizeRem, autoSplit);

  normalVerses.forEach((nv) => {
    const nvPages = splitVerseIntoPages(nv, allNormalVerses.length, sizeRem, autoSplit);
    nvPages.forEach(p => sequence.push({ ...p, slideIndex: sequence.length, isChorus: false }));
    chorusPages.forEach(cp => sequence.push({ ...cp, slideIndex: sequence.length, isChorus: true, displayLabel: cp.displayLabel || 'Refrein' }));
  });

  return sequence;
}

export function buildFullSongSequence(song, settings = {}, verseFilter = null) {
  const verses = song ? (song.verses || []) : [];
  if (verses.length === 0) return [];

  const interleave = settings.refrain_interleaving !== false;
  const isChorus = (v) => v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));
  const choruses = verses.filter(isChorus);
  const allNormalVerses = verses.filter(v => !isChorus(v));

  let normalVerses = allNormalVerses;
  if (verseFilter && Array.isArray(verseFilter) && verseFilter.length > 0) {
    normalVerses = allNormalVerses.filter((v, idx) => {
      const labelMatch = v.label ? v.label.match(/^(\d+)/) : null;
      const verseNum = labelMatch ? parseInt(labelMatch[1]) : (idx + 1);
      return verseFilter.includes(verseNum);
    });
    if (normalVerses.length === 0) normalVerses = allNormalVerses;
  }

  if (!interleave || choruses.length === 0 || normalVerses.length === 0) {
    const filtered = (verseFilter && Array.isArray(verseFilter) && verseFilter.length > 0)
      ? verses.filter((v, idx) => {
          if (isChorus(v)) return true;
          const labelMatch = v.label ? v.label.match(/^(\d+)/) : null;
          const normalIdx = allNormalVerses.indexOf(v);
          const verseNum = labelMatch ? parseInt(labelMatch[1]) : (normalIdx !== -1 ? normalIdx + 1 : idx + 1);
          return verseFilter.includes(verseNum);
        })
      : verses;

    return filtered.map((v, i) => ({
      ...v,
      displayLabel: v.label || (isChorus(v) ? 'Refrein' : `${i + 1}/${verses.length}`),
      lines: v.lines || (v.text ? v.text.split('\n') : []),
      isChorus: isChorus(v)
    }));
  }

  const mainChorus = choruses[0];
  const fullSequence = [];
  normalVerses.forEach((nv) => {
    const nvIdx = allNormalVerses.indexOf(nv);
    fullSequence.push({
      ...nv,
      displayLabel: nv.label || `${nvIdx !== -1 ? nvIdx + 1 : 1}/${allNormalVerses.length}`,
      lines: nv.lines || (nv.text ? nv.text.split('\n') : []),
      isChorus: false
    });
    fullSequence.push({
      ...mainChorus,
      displayLabel: mainChorus.label || 'Refrein',
      lines: mainChorus.lines || (mainChorus.text ? mainChorus.text.split('\n') : []),
      isChorus: true
    });
  });

  return fullSequence;
}

export function parseCustomSongLyrics(lyricsText) {
  const blocks = lyricsText.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  const verses = [];
  let verseCounter = 1;

  blocks.forEach((block) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const firstLineLower = lines[0].toLowerCase();
    const isChorus = firstLineLower.startsWith('reff') ||
                     firstLineLower.startsWith('ref') ||
                     firstLineLower.startsWith('chorus') ||
                     firstLineLower.startsWith('koor');

    let cleanLines = [...lines];
    let label = '';

    if (isChorus) {
      if (lines[0].includes(':')) {
        const parts = lines[0].split(':');
        if (parts.length > 1 && parts[1].trim()) cleanLines[0] = parts.slice(1).join(':').trim();
        else cleanLines.shift();
      } else if (/^(reff|ref|chorus|koor)$/i.test(lines[0])) {
        cleanLines.shift();
      }
      label = 'Refrein';
    } else {
      const matchBait = lines[0].match(/^(bait|verse|\d+)\s*[:.]?\s*(.*)/i);
      if (matchBait && matchBait[1]) {
        if (matchBait[2] && matchBait[2].trim()) cleanLines[0] = matchBait[2].trim();
        else if (/^(bait|verse)\s*\d*$/i.test(lines[0])) cleanLines.shift();
      }
      label = `Bait ${verseCounter++}`;
    }

    if (cleanLines.length > 0) {
      verses.push({
        type: isChorus ? 'chorus' : 'verse',
        label,
        lines: cleanLines,
        text: cleanLines.join('\n')
      });
    }
  });

  return verses;
}
