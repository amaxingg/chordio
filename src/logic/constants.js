import { Midi } from '@tonaljs/tonal';

// Standard tuning MIDI numbers for open strings: E2, A2, D3, G3, B3, E4
export const tuningMidi = ['E2','A2','D3','G3','B3','E4']
  .map(n => Midi.toMidi(n));

// Scale interval definitions
export const SCALE_INTERVALS = {
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
};
