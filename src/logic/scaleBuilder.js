import { Midi } from '@tonaljs/tonal';
import { SCALE_INTERVALS } from './constants.js';

// src/logic/scaleBuilder.js
export function buildScale(root, type) {
  /* add a default octave if the token is just “D”, “D#”, “Eb”, … */
  const needsOct = /^[A-G](?:[#b])?$/.test(root);
  const note     = needsOct ? `${root}4` : root;      // keeps accidentals
  const rootPc   = Midi.toMidi(note) % 12;            // 0‥11 pitch-class
  return SCALE_INTERVALS[type].map(i => (rootPc + i) % 12);
}
