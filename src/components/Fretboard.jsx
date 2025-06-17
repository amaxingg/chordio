// src/components/Fretboard.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';
import '../index.css';
import { tuningMidi } from '@logic/constants.js';   // ← add


// MIDI values for standard guitar tuning (E2–E4)
const stringTuningsMidi = [40, 45, 50, 55, 59, 64]; // E A D G B e

export default function Fretboard({
  startNoteDrag = () => {},      /* ← NEW: parent will pass drag handler */  numFrets = 12,
  width = '100%',
  height = '240px',
  setStringIndex = () => {},
  setFret        = () => {},
  onSelect       = () => {},
  noteDuration   = 2.5,
  setNoteDuration= () => {},
  scalePCs       = [],            /* ← array of pitch-classes in scale */

  /* 👁  new toggle (true = show; false = hide) */
 noteVisMode    = 'all',   /* 'all' | 'scale' | 'none' */
}) {





const armTimerRef = useRef(null);    // 200 ms hold-to-drag

const cancelHold = () => {
  if (armTimerRef.current) {
    clearTimeout(armTimerRef.current);
    armTimerRef.current = null;
  }
};


  const [isSamplerLoaded, setIsSamplerLoaded] = useState(false);
  const guitarSampler = useRef(null);

  // Load the guitar samples once on mount
const [isLoaded, setIsLoaded] = useState(false);
const sampleBuffers = useRef({}); // sampleBuffers[string][fret] = Tone.ToneAudioBuffer

const recordedFrets = [0, 3, 5, 7, 9, 12];

/*──── track left-mouse held globally ────*/
const mouseDownRef = useRef(false);

/* one timer per button so rapid re-clicks never cancel a fresh flash */
const flashTimersRef = useRef(new Map());


useEffect(() => {
  const down = (e) => { if (e.button === 0) mouseDownRef.current = true; };
  const up   = () => { mouseDownRef.current = false; };
  window.addEventListener('mousedown', down);
  window.addEventListener('mouseup',   up);
  return () => { window.removeEventListener('mousedown', down);
                 window.removeEventListener('mouseup',   up); };
}, []);




/* highlight fret-buttons that have just been played */
const [litKeys, setLitKeys] = useState(new Set());   // "s-f" strings

/* highlight a single fret-button (string index is 0-based) */
const flashButton = (sIndex, fret) => {
  const key = `${sIndex}-${fret}`;               // for litKeys state
  setLitKeys(prev => new Set(prev).add(key));

  /* 1. grey-chip highlight used by the note grid (600 ms) */
  setTimeout(() => {
    setLitKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, 600);

  /* 2. bright pulse on the actual fret-button ---------------------- */
  const btn = document.querySelector(
    `.fret-btn[data-string="${sIndex + 1}"][data-fret="${fret}"]`
  );
  if (!btn) return;

  /* restart the animation even on rapid repeats */
  btn.classList.remove('active');
  void btn.offsetWidth;               // force reflow
  btn.classList.add('active');

  /* clear any previous timer for this button so overlap never clips */
  const timers = flashTimersRef.current;
  if (timers.has(btn)) clearTimeout(timers.get(btn));

  const tid = setTimeout(
    () => btn.classList.remove('active'),
    noteDuration * 1000               // honour current sustain
  );
  timers.set(btn, tid);
};



/* tells whether a given string+fret is in the selected scale */
/* 0 – 11 → “C C# D … B”  (use sharps by default) */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/* get the printable note name for a given string + fret */
const noteName = (uiStringIdx, fret) => {
  const tuningIdx = tuningMidi.length - 1 - uiStringIdx;
  const pc        = (tuningMidi[tuningIdx] + fret) % 12;
  return NOTE_NAMES[pc];
};


/* returns 1-7 if the pitch class is in scalePCs, otherwise null */
const degreeIndex = (pc) => {
  const idx = scalePCs.indexOf(pc);   // 0 … 6  or  -1
  return idx === -1 ? null : idx + 1; // convert to 1-based degree
};



// Load all 36 samples
useEffect(() => {
  const loadAllSamples = async () => {
    const loadPromises = [];

    for (let s = 1; s <= 6; s++) {
      sampleBuffers.current[s] = {};

      for (let f of recordedFrets) {
        const fileName = `${s}_${f}.wav`;
        const path = `/samples/guitar/${fileName}`;

 const promise = new Promise((resolve, reject) => {
  new Tone.ToneAudioBuffer({
    url: path,
    onload: buffer => {
      sampleBuffers.current[s][f] = buffer;
      resolve();
    },
    onerror: err => {
      console.error(`❌ Failed to load ${fileName}:`, err);
      reject(err);
    }
  });
});


        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);
    console.log("🎸 All 36 samples loaded");
    setIsLoaded(true);
  };

  loadAllSamples();
}, []);



const playNote = async (stringIndex, fret) => {
  const string = 6 - stringIndex;

  if (!isLoaded || !sampleBuffers.current[string]) {
    console.warn("⚠️ Samples not fully loaded yet");
    return;
  }

  const availableFrets = Object.keys(sampleBuffers.current[string]).map(Number);
  const nearestFret = availableFrets.reduce((prev, curr) =>
    Math.abs(curr - fret) < Math.abs(prev - fret) ? curr : prev
  );

  const buffer = sampleBuffers.current[string][nearestFret];
  const pitchShift = fret - nearestFret;

  if (!buffer) {
    console.warn(`⚠️ No sample for string ${string} at fret ${nearestFret}`);
    return;
  }

await Tone.start();

const now = Tone.now();
const fadeStart = now + noteDuration * 0.95;
const fadeEnd = now + noteDuration;

const gain = new Tone.Gain(1).toDestination();     // ✅ create gain node
const source = new Tone.Player(buffer).connect(gain); // ✅ connect player to gain
source.playbackRate = Math.pow(2, pitchShift / 12);  // ✅ pitch shift

gain.gain.setValueAtTime(1, now);
gain.gain.linearRampToValueAtTime(0, fadeEnd);

source.start(now, 0, noteDuration); // ✅ play

};




  const fretToNutMM = [
    29.466, 57.278, 83.529, 108.307,
    131.694, 153.769, 174.605, 194.271,
    212.833, 230.354, 246.891, 262.500
  ];
  const scaleLen = fretToNutMM[fretToNutMM.length - 1];
  const fretPercents = [0, ...fretToNutMM.map(mm => (mm / scaleLen) * 100)];
  const stringGaugePx = [2, 2, 3, 4, 5, 6];

  const zeroFretWidth = 52;          // ~22 % wider
  const fretboardStyle = {
    display: 'flex',
    alignItems: 'stretch',
    width,
    height,
    marginBottom: '1rem',
  };
  const commonContainerStyle = {
    position: 'relative',
    height: '100%',
    backgroundColor: 'transparent',
    borderTop:    `${stringGaugePx[0]}px solid var(--fretboard-string)`,
    borderBottom: `${stringGaugePx[5]}px solid var(--fretboard-string)`,
  };
  const zeroFretStyle = {
    ...commonContainerStyle,
    width: `${zeroFretWidth}px`,
    borderLeft: '6px solid #000',
    borderRight: '2px solid #000',
    marginRight: '8px'
  };
  const mainFretStyle = {
    ...commonContainerStyle,
    flex: 1,
    borderLeft: '6px solid #000'
  };

  const renderStrings = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} style={{
        position: 'absolute',
        top: `${((i + 1) / 5) * 100}%`,
        left: 0,
        width: '100%',
        height: `${stringGaugePx[i + 1]}px`,
        backgroundColor: 'var(--fretboard-string)'
      }} />
    ))
  );

  const renderFrets = () => (
    fretPercents.slice(1).map((left, idx) => (
      <div key={idx} style={{
        position: 'absolute',
        left: `calc(${left}% - 1px)`,
        top: 0,
        width: '2px',
        height: '100%',
        backgroundColor: 'var(--fretboard-line)',
      }} />
    ))
  );

const renderDots = () => {
  const dots = [];
  [3, 5, 7, 9].forEach(f => {
    const left = fretPercents[f] - (fretPercents[f] - fretPercents[f - 1]) / 2;
    dots.push(
      <div
        key={f}
        style={{
          position: 'absolute',
          left: `${left}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 20,          // ⬅︎ was 10
          height: 20,         // ⬅︎ was 10
          backgroundColor: 'var(--fretboard-inlay)',
          borderRadius: '50%',
        }}
      />
    );
  });

  /* double-dot at 12th fret */
  if (numFrets >= 12) {
    const left12 =
      fretPercents[12] - (fretPercents[12] - fretPercents[11]) / 2;
    [30, 70].forEach((top, idx) =>
      dots.push(
        <div
          key={`12-${idx}`}
          style={{
            position: 'absolute',
            left: `${left12}%`,
            top: `${top}%`,
            transform: 'translate(-50%, -50%)',
            width: 20,        // ⬅︎ was 10
            height: 20,       // ⬅︎ was 10
            backgroundColor: 'var(--fretboard-inlay)',
            borderRadius: '50%',
          }}
        />
      )
    );
  }

  return dots;
};

const renderButtons = () => {
  const buttons = [];

  for (let si = 0; si < 6; si++) {
    const yCenter = (si / 5) * 100;
    const h = (1 / 5) * 100 * 0.6;

    for (let f = 1; f <= numFrets; f++) {
      const left = fretPercents[f - 1];
      const w = fretPercents[f] - fretPercents[f - 1];



/* new 3-state-aware version */
/* --------------------------------- FRET BUTTON (f ≥ 1) ---------------- */
const key = `${si}-${f}`;                      // unique for string+fret
const pc  = (tuningMidi[tuningMidi.length - 1 - si] + f) % 12;
const inScale = degreeIndex(pc) !== null;

buttons.push(
  <button
    key={`btn-${si}-${f}`}                     // ← unique key
    className={`fret-btn ${inScale ? `in-scale deg-${degreeIndex(pc)}` : ''}`}
    data-string={si + 1}
    data-fret={f}

    /* hold-to-drag + click-play */
    onMouseDown={e => {
      if (e.button !== 0) return;

      /* 200 ms arm-timer → startNoteDrag */
      const sx = e.clientX, sy = e.clientY;
      armTimerRef.current = setTimeout(() => {
        startNoteDrag({ string: si + 1, fret: f }, sx, sy);
        e.currentTarget.classList.add('drag-origin');
        armTimerRef.current = null;
      }, 200);

      /* immediate feedback */
      playNote(si, f);
      flashButton(si, f);
      setStringIndex(si + 1);
      setFret(f);
    }}
    onMouseMove={cancelHold}
    onMouseLeave={cancelHold}
    onMouseUp={cancelHold}

    onMouseEnter={() => {
      if (mouseDownRef.current) {              // no dragRef check needed here
        playNote(si, f);
        flashButton(si, f);
      }
    }}
    onContextMenu={e => {
      e.preventDefault();
       playNote(si, f);                     // 🔊 play the note
 flashButton(si, f);                  // 💡 pulse the chip
 setStringIndex(si + 1);              // sync the sidebar dropdowns
 setFret(f);
      onSelect({ string: si + 1, fret: f });
    }}
    style={{
      position: 'absolute',
      left:  `${left}%`,
      width: `${w}%`,
      top:   `calc(${yCenter}% - ${h / 2}%)`,
      height:`${h}%`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.65rem',
      zIndex: 4,
    }}
  >
    <span
      className="chip"
      style={{
        opacity:
          noteVisMode === 'all'
            ? undefined
          : noteVisMode === 'scale'
            ? (inScale || litKeys.has(key) ? undefined : 0)
            : /* 'none' */ (litKeys.has(key) ? undefined : 0),
      }}
    >
      {noteName(si, f)}
    </span>
  </button>
);





    }
  }
  return buttons;
};

/* --- ZERO-FRET BUTTONS (open strings) ------------------------------ */
const renderZeroFretButtons = () => {
  const buttons = [];
  for (let si = 0; si < 6; si++) {
    const yCenter = (si / 5) * 100;
    const h = (1 / 5) * 100 * 0.6;

/* scale-membership for the open string (fret 0) */
const pc0      =  tuningMidi[tuningMidi.length - 1 - si] % 12;
const inScale0 =  degreeIndex(pc0) !== null;

buttons.push(
 <button
  key={`btn-${si}-0`}
  className={`fret-btn ${
    inScale0 ? `in-scale deg-${degreeIndex(pc0)}` : ''
  }`}
  data-string={si + 1}
  data-fret={0}

  /* single MouseDown: start drag timer + immediate play */
  onMouseDown={e => {
    if (e.button !== 0) return;       // left-click only

    /* 1️⃣  start 200 ms hold-to-drag */
    const sx = e.clientX, sy = e.clientY;
    armTimerRef.current = setTimeout(() => {
      startNoteDrag(
        { string: si + 1, fret: 0 },  // ← correct vars
        sx, sy
      );
      e.currentTarget.classList.add('drag-origin');
      armTimerRef.current = null;
    }, 200);

    /* 2️⃣  immediate click feedback */
    playNote(si, 0);
    flashButton(si, 0);
    setStringIndex(si + 1);
    setFret(0);
  }}
  onMouseMove={cancelHold}
  onMouseLeave={cancelHold}
  onMouseUp={cancelHold}

  onMouseEnter={() => {
     if (mouseDownRef.current) {
      playNote(si, 0);
      flashButton(si, 0);
    }
  }}
  onContextMenu={e => {
    e.preventDefault();
     playNote(si, 0);
 flashButton(si, 0);
 setStringIndex(si + 1);
 setFret(0);
    onSelect({ string: si + 1, fret: 0 });
  }}
  style={{
    position: 'absolute',
    left: 0,
    top: `calc(${yCenter}% - ${h / 2}%)`,
    width: '100%',
    height: `${h}%`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.65rem',
    zIndex: 4,
  }}
>
  <span
    className="chip"
    style={{
      opacity:
        noteVisMode === 'all'
          ? undefined
          : noteVisMode === 'scale'
          ? (inScale0 || litKeys.has(`${si}-0`) ? undefined : 0)
          : /* 'none' */ (litKeys.has(`${si}-0`) ? undefined : 0),
    }}
  >
    {noteName(si, 0)}
  </span>
</button>

);

  }
  return buttons;
};

/* ======================= RENDER =================================== */
return (
  <div className="flex flex-col" style={{ width }}>

    {/* main fretboard ------------------------------------------------ */}
<div className="rounded-xl p-2" style={{ ...fretboardStyle, backgroundColor: 'var(--fretboard-bg)' }}>
      <div style={zeroFretStyle}>
        {renderStrings()}
        {renderZeroFretButtons()}
      </div>
      <div style={mainFretStyle}>
        {renderStrings()}
        {renderFrets()}
        {renderDots()}
        {renderButtons()}
      </div>
    </div>

    {/* fret-number ruler -------------------------------------------- */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '24px',
        marginBottom: '8px',
      }}
    >
      {/* “0” over the nut */}
      <div
        style={{
          width: `${zeroFretWidth}px`,
          marginRight: '8px',
          position: 'relative',
          height: '24px',
        }}
      >
        <div
        className="fret-label"
          style={{
  position:'absolute',
  top:0,
  left:'50%',
  transform:'translateX(-50%)',
            fontSize: '0.75rem',
          }}
        >
          0
        </div>
      </div>

     {/* 1-N labels */}
<div style={{ flex: 1, position: 'relative', height: '100%' }}>
  {fretPercents.slice(0, numFrets).map((left, idx) => {
    const center = left + (fretPercents[idx + 1] - left) / 2;

    return (
      <div
        key={idx + 1}
        className="fret-label"                 // ← pill class
        style={{
          position: 'absolute',
          left: `${center}%`,
          transform: 'translateX(-50%)',
        }}
      >
        {idx + 1}
      </div>
    );
  })}
</div>

    </div>
  </div>
);   // ← end of return
}     // ← **DON’T forget this final brace!**
