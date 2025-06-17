import { buildScale } from './scaleBuilder.js';
import { loadAllShapes, fitsScale, matchesMelody } from './filter.js';
import { playabilityScore } from './rank.js';
import { tuningMidi } from './constants.js';

export function recommendChords(root, type, stringIdx, fretSel) {
  const scalePCs = buildScale(root, type);
  const melodyMidi = tuningMidi[stringIdx] + fretSel;

  return loadAllShapes()
    .filter(p => fitsScale(p, scalePCs))
    .filter(p => matchesMelody(p, stringIdx, fretSel, melodyMidi))
    .map(p => ({ ...p, score: playabilityScore(p) }))
    .sort((a, b) => a.score - b.score);
}
