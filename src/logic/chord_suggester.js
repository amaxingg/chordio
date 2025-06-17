#!/usr/bin/env node
// logic/chord_suggester.js
// Simple CLI that mirrors your grouped-index logic in the terminal

import { recommendChords } from './recommendChords.js';
import { tuningMidi }       from './constants.js';
import { loadAllShapes, fitsScale, computePositionMidi } from './filter.js';
import { buildScale }       from './scaleBuilder.js';
import { playabilityScore } from './rank.js';

// Parse args: root, scaleType, stringIdx (0–5), fret, [optional 'contains']
const [,, root, scaleType, strIdxArg, fretArg, mode] = process.argv;
if (!root || !scaleType || strIdxArg == null || fretArg == null) {
  console.error('Usage: node logic/chord_suggester.js <root> <major|minor> <stringIdx 0-5> <fret> [contains]');
  process.exit(1);
}
const stringIdx = Number(strIdxArg);
const fretSel   = Number(fretArg);

// Precompute scale & melody note
const pcs        = buildScale(root, scaleType);
const melodyMidi = tuningMidi[stringIdx] + fretSel;

let shapes;
// “Contains” mode vs. highest-note mode
if (mode === 'contains') {
  shapes = loadAllShapes()
    .filter(p => fitsScale(p, pcs))
    .filter(p => computePositionMidi(p).includes(melodyMidi))
    .map(p => ({ ...p, score: playabilityScore(p) }))
    .sort((a, b) => a.score - b.score);
} else {
  shapes = recommendChords(root, scaleType, stringIdx, fretSel);
}

// Output grouped by category (optional—same logic as index.js)
const suffixGroups = {
  basic:     ['', 'maj', 'm'],
  sevenths:  ['7','m7'],
  extended:  ['9','11','13'],
  suspended: ['sus2','sus4'],
  power:     ['5'],
};
const categories = { basic: [], sevenths: [], extended: [], suspended: [], power: [], altered: [] };
shapes.forEach(p => {
  let cat = 'altered';
  const s = p.suffix || '';
  for (const [grp, keys] of Object.entries(suffixGroups)) {
    if (keys.includes(s) || keys.some(k => s.includes(k) && (grp==='extended' || grp==='suspended'))) {
      cat = grp; break;
    }
  }
  categories[cat].push(p);
});

console.log(`Chords in ${root} ${scaleType} with melody on string ${stringIdx}, fret ${fretSel}${mode==='contains'?' (contains)':''}:\n`);
for (const [cat, list] of Object.entries(categories)) {
  if (!list.length) continue;
  console.log(cat.toUpperCase() + ':');
  list.forEach(p => {
    const shape = p.frets.map(f =>
      f>0? f+p.baseFret-1 : (f===0? '0' : 'x')
    ).join('-');
    console.log(`  ${p.key}${p.suffix}: ${shape} | score ${p.score.toFixed(1)}`);
  });
  console.log();
}
