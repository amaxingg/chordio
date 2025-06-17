import chordDB from './full_guitar_db.json' assert { type: 'json' };
import { tuningMidi } from './constants.js';

// Replace this in filter.js:
export function computePositionMidi(position) {
  return position.frets.map((f, i) => {
    if (f < 0) return null;            // only drop muted strings
const absFret = f === 0           // open string stays open
  ? 0
  : position.baseFret + f - 1;    // fretted note shifts by baseFret
    const midi    = tuningMidi[i] + absFret;
    return midi;
  });
}


export function fitsScale(position, scalePCs) {
  return computePositionMidi(position)
    .every(m => m == null || scalePCs.includes(m % 12));
}

export function matchesMelody(position, stringIdx, fretSel, melodyMidi) {
  const rel = position.frets[stringIdx];
  if (rel <= 0) return false;
  const abs = position.baseFret + rel - 1;
  if (abs !== fretSel) return false;
  return Math.max(...computePositionMidi(position).filter(m => m != null)) === melodyMidi;
}

let _allShapes = null;
export function loadAllShapes() {
  if (_allShapes) return _allShapes;          // ← reuse on every call
  _allShapes = Object.values(chordDB.chords)
    .flatMap(list =>
      list.flatMap(ch =>
        ch.positions.map(pos => ({ key: ch.key, suffix: ch.suffix, ...pos }))
      )
    );
  return _allShapes;
}
