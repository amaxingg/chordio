// src/index.js
import { recommendChords } from './recommendChords.js';
import { loadAllShapes, fitsScale, computePositionMidi } from './filter.js';
import { playabilityScore } from './rank.js';
import { buildScale } from './scaleBuilder.js';
import { tuningMidi } from './constants.js';

// CLI entry point (ESM)
// Accept 1-based string index input from user (1 = low E string)
const [,, root, type, strIdxArg, fretArg, mode] = process.argv;
if (!root || !type || strIdxArg == null || fretArg == null) {
  console.error('Usage: node src/index.js <root> <major|minor> <stringIdx 1-6> <fret> [contains]');
  process.exit(1);
}

// Convert to 0-based (0 = low E)
const stringIdx = Number(strIdxArg) - 1;
const fretSel = Number(fretArg);
const scalePCs = buildScale(root, type);
const melodyMidi = tuningMidi[stringIdx] + fretSel;

// gather candidates
let candidates;
if (mode === 'contains') {
  candidates = loadAllShapes()
    .filter(p => fitsScale(p, scalePCs))
    .filter(p => computePositionMidi(p).some(m => m === melodyMidi))
    .map(p => ({ ...p, score: playabilityScore(p) }))
    .sort((a, b) => a.score - b.score);
} else {
  candidates = recommendChords(root, type, stringIdx, fretSel);
}

console.log(`Chords in ${root} ${type} with melody on string ${stringIdx}, fret ${fretSel}${mode === 'contains' ? ' (contains mode)' : ''}:`);

// categorize by suffix
const categories = { basic: [], sevenths: [], extended: [], suspended: [], power: [], altered: [] };
const suffixGroups = {
  basic: ['', 'maj', 'min', 'm'],
  sevenths: ['7', 'm7'],
  extended: ['9', '11', '13'],
  suspended: ['sus2', 'sus4'],
  power: ['5'],
};

candidates.forEach(r => {
  const raw = r.suffix ?? '';
  let cat = 'altered';
  for (const [group, keys] of Object.entries(suffixGroups)) {
    if (keys.includes(raw) || keys.some(k => raw.includes(k) && ['extended','suspended'].includes(group))) {
      cat = group;
      break;
    }
  }
  categories[cat].push(r);
});

// display grouping by category, then chord name, then shapes
const suffixMap = { '': '', maj: '', min: 'm', m: 'm', m7: 'm7', '7': '7', '5': '5', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4' };
const titles = { basic: 'Basic Triads', sevenths: 'Seventh Chords', extended: 'Extended (9th,11th,13th)', suspended: 'Suspended Chords', power: 'Power Chords', altered: 'Altered/Others' };

for (const [catKey, list] of Object.entries(categories)) {
  if (!list.length) continue;
  console.log(`\n${titles[catKey]}:`);
  // group by chord name
  const chordMap = {};

  list.forEach(r => {
    const rawSuffix = r.suffix ?? '';
    const dispSuffix = suffixMap[rawSuffix] !== undefined ? suffixMap[rawSuffix] : rawSuffix;
    const chordName = `${r.key}${dispSuffix}`;
    const abs = r.frets.map(f => {
      if (f > 0) return f + r.baseFret - 1;
      if (f === 0) return 0;
      return 'x';
    });
    chordMap[chordName] = chordMap[chordName] || [];
    chordMap[chordName].push(abs);
  });

  // print each chord with its shapes
  for (const [chordName, shapes] of Object.entries(chordMap)) {
    console.log(`\n${chordName}:`);
    shapes.forEach((shape, idx) =>
      console.log(`  Shape ${idx+1}: ${shape.join('-')}`)
    );
  }
}