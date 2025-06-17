import * as Tone from 'tone';

const recordedFrets = [0, 3, 5, 7, 9, 12];
const sampleBuffers = {};  // sampleBuffers[string][fret]
let isLoaded = false;

/* ---- sample loader (unchanged logic) ---- */
export async function ensureSamplesLoaded() {
  if (isLoaded) return;

  const tasks = [];
  for (let s = 1; s <= 6; s++) {
    sampleBuffers[s] = {};
    for (let f of recordedFrets) {
      const path = `/samples/guitar/${s}_${f}.wav`;
      tasks.push(
        new Promise((res, rej) => {
          new Tone.ToneAudioBuffer({
            url: path,
            onload: (buf) => { sampleBuffers[s][f] = buf; res(); },
            onerror: rej,
          });
        })
      );
    }
  }
  await Promise.all(tasks);
  isLoaded = true;
}

/* ---- play a single note with fade-out ---- */
export async function playNote(rowIdx, fret, durationSec = 2.5) {
  await ensureSamplesLoaded();

  const stringNum = 6 - rowIdx;              // sample rows: 1=low-E, 6=high-e
  const map = sampleBuffers[stringNum];
  if (!map) return;

  const nearest = Object.keys(map)
    .map(Number)
    .reduce((a, b) => (Math.abs(b - fret) < Math.abs(a - fret) ? b : a));

  const buffer = map[nearest];
  const gain = new Tone.Gain(1).toDestination();
  const player = new Tone.Player(buffer).connect(gain);
  player.playbackRate = Math.pow(2, (fret - nearest) / 12);

  await Tone.start();                   // resume AudioContext

const now = Tone.now();
gain.gain.setValueAtTime(1, now);
gain.gain.linearRampToValueAtTime(0, now + durationSec); // ← fade time
player.start(now);
player.stop(now + durationSec + 0.1);

}
