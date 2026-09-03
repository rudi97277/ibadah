export function getMaxLinesForFontSize(sizeRem, defaultSize = 3.6) {
  const size = parseFloat(sizeRem) || defaultSize;
  if (size <= 2.4) return 8;
  if (size <= 3.2) return 6;
  if (size <= 4.0) return 4;
  return 2;
}

export function getMaxCharsForFontSize(sizeRem, defaultSize = 3.6) {
  let size = parseFloat(sizeRem) || defaultSize;
  size = Math.max(1.5, Math.min(8.0, size));
  const baseSize = 3.6;
  const baseChars = 320;
  const ratio = baseSize / size;
  return Math.max(100, Math.round(baseChars * Math.pow(ratio, 1.5)));
}

export function splitVerseIntoPages(v, totalVersesCount, sizeRem = 3.4, autoSplit = true) {
  const rawLines = v.lines || (v.text ? v.text.split('\n') : []);
  const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const isChorus = v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));
  const baseLabel = v.label || (isChorus ? 'Refrein' : (totalVersesCount ? `1/${totalVersesCount}` : '1/1'));

  if (!autoSplit) {
    return [{
      ...v,
      lines: lines,
      text: lines.join('\n'),
      displayLabel: baseLabel,
      label: baseLabel,
      isChorus: isChorus
    }];
  }

  const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
  const maxLines = getMaxLinesForFontSize(sizeRem);
  const maxChars = getMaxCharsForFontSize(sizeRem);
  const n = lines.length;

  let shouldSplit = false;
  let chunks = [];

  if (n > maxLines || totalChars > maxChars) {
    shouldSplit = true;
    if (n === 4 || n === 3) {
      chunks = [lines.slice(0, 2), lines.slice(2)];
    } else if (n === 5 || n === 6) {
      const mid = Math.ceil(n / 2);
      chunks = [lines.slice(0, mid), lines.slice(mid)];
    } else if (n === 7 || n === 8) {
      chunks = [lines.slice(0, 4), lines.slice(4)];
    } else {
      for (let i = 0; i < n; i += 4) {
        chunks.push(lines.slice(i, i + 4));
      }
    }
  }

  if (!shouldSplit || chunks.length <= 1) {
    return [{
      ...v,
      lines: lines,
      text: lines.join('\n'),
      displayLabel: baseLabel,
      label: baseLabel,
      isChorus: isChorus
    }];
  }

  return chunks.map((chunkLines, cIdx) => ({
    ...v,
    displayLabel: baseLabel,
    label: baseLabel,
    lines: chunkLines,
    text: chunkLines.join('\n'),
    subPageIndex: cIdx,
    subPageTotal: chunks.length,
    isChorus: isChorus
  }));
}

export function buildSlideSequence(song, settings = {}, sizeRem = 3.4) {
  const verses = song ? (song.verses || []) : [];
  if (verses.length === 0) return [];

  const autoSplit = settings.auto_split_long_verses !== false;
  const interleave = settings.refrain_interleaving !== false;
  const isChorus = (v) => v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));

  const choruses = verses.filter(isChorus);
  const normalVerses = verses.filter(v => !isChorus(v));

  const sequence = [];

  if (!interleave || choruses.length === 0 || normalVerses.length === 0) {
    verses.forEach((v) => {
      const pages = splitVerseIntoPages(v, verses.length, sizeRem, autoSplit);
      pages.forEach((p) => {
        sequence.push({
          ...p,
          slideIndex: sequence.length,
          isChorus: isChorus(v)
        });
      });
    });
    return sequence;
  }

  const mainChorus = choruses[0];
  const chorusPages = splitVerseIntoPages(mainChorus, 0, sizeRem, autoSplit);

  normalVerses.forEach((nv) => {
    const nvPages = splitVerseIntoPages(nv, normalVerses.length, sizeRem, autoSplit);
    nvPages.forEach((p) => {
      sequence.push({
        ...p,
        slideIndex: sequence.length,
        isChorus: false
      });
    });

    chorusPages.forEach((cp) => {
      sequence.push({
        ...cp,
        slideIndex: sequence.length,
        isChorus: true,
        displayLabel: cp.displayLabel || 'Refrein'
      });
    });
  });

  return sequence;
}

export function buildFullSongSequence(song, settings = {}) {
  const verses = song ? (song.verses || []) : [];
  if (verses.length === 0) return [];

  const interleave = settings.refrain_interleaving !== false;
  const isChorus = (v) => v.type === 'chorus' || (v.label && (v.label.toLowerCase().includes('ref') || v.label.toLowerCase().includes('koor') || v.label.toLowerCase().includes('chorus')));
  const choruses = verses.filter(isChorus);
  const normalVerses = verses.filter(v => !isChorus(v));

  if (!interleave || choruses.length === 0 || normalVerses.length === 0) {
    return verses.map((v, i) => ({
      ...v,
      displayLabel: v.label || (isChorus(v) ? 'Refrein' : `${i + 1}/${verses.length}`),
      lines: v.lines || (v.text ? v.text.split('\n') : []),
      isChorus: isChorus(v)
    }));
  }

  const mainChorus = choruses[0];
  const fullSequence = [];
  normalVerses.forEach((nv, nvIdx) => {
    fullSequence.push({
      ...nv,
      displayLabel: nv.label || `${nvIdx + 1}/${normalVerses.length}`,
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

export function parseCustomSongLyrics(lyrics) {
  const blocks = (lyrics || '').split(/\n\s*\n+/);
  const parsedBlocks = [];

  blocks.forEach((blk) => {
    const rawLines = blk.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return;

    const firstLine = rawLines[0].toLowerCase();
    let isChorus = false;
    let customLabel = '';
    let linesToKeep = [...rawLines];

    if (firstLine.startsWith('reff:') || firstLine.startsWith('reff') || firstLine.startsWith('chorus:') || firstLine.startsWith('refrein:') || firstLine.startsWith('ref:')) {
      isChorus = true;
      if (rawLines[0].match(/^(reff|refrein|chorus|koor)[:\s]*$/i)) {
        linesToKeep.shift();
      } else {
        linesToKeep[0] = linesToKeep[0].replace(/^(reff|refrein|chorus|koor)[:\s]*/i, '').trim();
      }
    } else {
      const matchCustomLabel = rawLines[0].match(/^([0-9]+\/[0-9]+|bait\s*[0-9]+|[0-9]+)[\.:\s]*$/i);
      if (matchCustomLabel) {
        customLabel = matchCustomLabel[1];
        linesToKeep.shift();
      }
    }

    if (linesToKeep.length > 0) {
      parsedBlocks.push({
        isChorus: isChorus,
        customLabel: customLabel,
        lines: linesToKeep
      });
    }
  });

  const totalNormalVerses = parsedBlocks.filter(b => !b.isChorus).length;
  let normalVerseIdx = 0;

  return parsedBlocks.map(b => {
    if (b.isChorus) {
      return {
        type: 'chorus',
        label: 'Refrein',
        lines: b.lines
      };
    }
    normalVerseIdx++;
    let label = b.customLabel;
    if (!label || !label.includes('/')) {
      label = `${normalVerseIdx}/${totalNormalVerses || 1}`;
    }
    return {
      type: 'verse',
      label: label,
      lines: b.lines
    };
  });
}
