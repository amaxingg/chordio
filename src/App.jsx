// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Scale as TonalScale } from '@tonaljs/tonal';

import Fretboard          from './components/Fretboard.jsx';
import ChordDisplay       from './components/ChordDisplay.jsx';
import SelectedNotesBoard from './components/SelectedNotesBoard.jsx';
import ContextMenu        from './components/ContextMenu.jsx';

import { buildScale }          from '@logic/scaleBuilder.js';
import { loadAllShapes, fitsScale, computePositionMidi } from '@logic/filter.js';
import { playabilityScore }    from '@logic/rank.js';
import { tuningMidi }          from '@logic/constants.js';
import { playNote }            from './lib/notePlayer.js';

import ChordSidebar from './components/ChordSidebar.jsx';

import FretboardToolbar from './components/FretboardToolbar.jsx';


/* ────────────────────────────────────────────────────────── */
export default function App() {
  /* CONSTANTS ------------------------------------------------ */
  const BEATS_PER_MEASURE = 8;
  const BEAT_MS           = 600;      // 100 BPM

  /* USER STATE ---------------------------------------------- */
  const [root,  setRoot]       = useState('C');
  const [scaleType, setScaleType] = useState('major');
  const [stringIdx, setStringIdx] = useState(1);
  const [fret,  setFret]       = useState(0);
  const undoStack = useRef([]);   // ← NEW (start as [])

const [exactPositionOnly, setExactPositionOnly] = useState(true);

/* —— USER STATE —— */
const [showOutside,       setShowOutside]       = useState(false);
const [truncateHigher,    setTruncateHigher]    = useState(true);   // NEW


/* 🎯  Eraser-mode toggle */
const [eraseMode,  setEraseMode]  = useState(false);

/* Chord-sidebar open / closed */
const [sidebarOpen, setSidebarOpen] = useState(true);

/* 0 = all notes • 1 = scale only • 2 = hide all  */
const [noteVisIdx, setNoteVisIdx] = useState(1);   // default ⇒ “Show in-scale only”
const noteVisModes = ['all', 'scale', 'none'];     // helper map

/* 🎸 true while a sidebar chord is being dragged */
const [isChordDragging, setIsChordDragging] = useState(false);


  /* GRID / PLAYBACK ----------------------------------------- */
const [beats, setBeats] = useState(BEATS_PER_MEASURE); // start with 1 measure
const [selectedNotes, setSelectedNotes] = useState([]);
const [ghostNotes,   setGhostNotes]   = useState([]);   // ← live preview





// ──────────────────────────────────────────────────────────
// Undo-stack helper
// ──────────────────────────────────────────────────────────
const pushHistory = (snapshot) => {
  const stack = undoStack.current;
  if (!stack.length || stack.at(-1) !== snapshot) {
    stack.push(snapshot);
    if (stack.length > 50) stack.shift();   // cap size
  }
};
// ──────────────────────────────────────────────────────────
// QUICK-INSERT a full chord at the next free beat
// (called by ChordSidebar right-click OR drag-drop)
// ──────────────────────────────────────────────────────────
const quickInsertChord = (shape) => {
  // 1) translate the chord shape into note objects
  const chordNotes = shape.frets.flatMap((rel, dbIdx) => {
    if (rel == null || rel < 0) return [];
    const uiString = 6 - dbIdx;                   // DB → UI order
    const absFret  = rel > 0 ? shape.baseFret + rel - 1 : 0;
    return [{ string: uiString, fret: absFret }];
  });
  if (!chordNotes.length) return;

  // 2) find first beat where none of the notes collide
  let beat = 0;
  const spanEnd  = (b) => b + noteLenBeats - 1;
 const collides = (b) => {
   const end = spanEnd(b);                 // last beat the chord will use
   return selectedNotes.some(n => {
     const nStart = n.beat;
     const nEnd   = n.beat + (n.duration ?? 1) - 1;
     // any overlap, regardless of string
     return !(end < nStart || b > nEnd);
   });
 };
  while (collides(beat)) beat += 1;

  // 3) extend the grid if we would run off the end
  const lastNeeded = beat + noteLenBeats - 1;
  if (lastNeeded >= beats) {
    const extra = Math.floor(lastNeeded / BEATS_PER_MEASURE) + 1;
    setBeats(extra * BEATS_PER_MEASURE);
  }

  // 4) commit to state (+ undo snapshot)
  pushHistory(selectedNotes);
  setSelectedNotes(prev => [
    ...prev,
    ...chordNotes.map(c => ({
      id      : crypto.randomUUID(),
      string  : c.string,
      fret    : c.fret,
      beat,
      duration: noteLenBeats,
    })),
  ]);
};






const handleUndo = () => {
  if (!undoStack.current.length) return;
  const prev = undoStack.current.pop();
  setSelectedNotes(prev);
};


// at the very top of App() – right after your other hooks
useEffect(() => {
  const handleContextMenu = e => {
    // Skip <button> elements (or anything *inside* a button)
    if (e.target.closest('button')) return;
    e.preventDefault();          // block the browser menu
  };

  document.addEventListener('contextmenu', handleContextMenu);
  return () => document.removeEventListener('contextmenu', handleContextMenu);
}, []);



/* 🔄  Always make the grid long enough for the right-most pill */
useEffect(() => {
  const lastBeat = selectedNotes.reduce(
    (max, n) => Math.max(max, n.beat + (n.duration ?? 1) - 1),
    0
  );
  const neededBeats =
    (Math.floor(lastBeat / BEATS_PER_MEASURE) + 1) * BEATS_PER_MEASURE;

  if (neededBeats !== beats) setBeats(neededBeats);
}, [selectedNotes, beats]);


  const [currentBeat, setCurrentBeat]     = useState(0);
  const [startBeat,  setStartBeat]  = useState(0);   // NEW ▸ where Play starts

  const [activeIds, setActiveIds]         = useState(new Set());
  const [playheadProgress, setPlayheadProgress] = useState(null);
  const playTimer   = useRef(null);
  const timeoutsRef = useRef([]);

  /* remembers the “active”-class timer for every fret-button */
const flashTimersRef = useRef(new Map());

/* LOOP ----------------------------------------------------- */
const [loopOn, setLoopOn] = useState(false);   // UI toggle
const loopRef             = useRef(false);     // stable inside callbacks

const [zoom, setZoom] = useState(0.5);   // 1 = 100 %

const ZOOM_BASE = 0.5;   // 0.5 = 50 % actual scale ➜ show as 100 %



useEffect(() => { loopRef.current = loopOn; }, [loopOn]);

/* ── Drag a full chord (hold sidebar pill for 0.2 s) ───────── */
/* If you already have a startChordDrag helper further down,    */
/* you can delete this stub—just make sure the name exists.     */



/* ── Drag-and-drop a full chord from the sidebar ─────────── */
const startChordDrag = (shape, startX, startY) => {
  setIsChordDragging(true);    
      let lastRow  = null;   // track hover position for preview sound
  let lastBeat = null;
  const BW = 72 * zoom;   // beat-width scales with zoom
  const RH = 48;                   // beat-width / row-height
  const box = scrollRef.current; if (!box) return;

/* map page-coords → beat column + string row */
const toGrid = (x, y) => {
  const r = box.getBoundingClientRect();

  const GUTTER = 36;                                     // label gutter
  const relX   = x - r.left - GUTTER + box.scrollLeft;   // horizontal
  const relY   = y - r.top;                              // vertical

  const beat = Math.floor(relX / BW);
  const row  = Math.floor(relY / RH);                    // 0 = top string

  /* inside current grid? */
  const valid =
    relX >= 0 && relY >= 0 &&           // inside box
    beat >= 0 && beat < beats &&        // not beyond last measure
    row  >= 0 && row  < 6;              // six guitar strings

  return { beat, row, valid };
};


  /* live preview on move */
  const mouseMove = e => {
    const { beat, row } = toGrid(e.clientX, e.clientY);

    /* build translucent ghost array */
    const ghosts = shape.frets.flatMap((rel, dbIdx) => {
      if (rel == null || rel < 0) return [];
      const uiString = 6 - dbIdx;                   // DB → UI order
      const absFret  = rel > 0 ? shape.baseFret + rel - 1 : 0;
      return [{
        id    : `ghost-${dbIdx}`,                  // stable key
        string: uiString,
        fret  : absFret,
        beat,
        duration: noteLenBeats,
      }];
    });
ghostRef.current = ghosts;                     // live copy for mouseUp
setGhostNotes(ghosts);                         // 👻 update preview

 // ▶︎  play preview when we hover a *different* cell
 if (row !== lastRow || beat !== lastBeat) {

 }

                     // 👻 update preview
  };

// --- single-note drag (stub) ------------------------------------------
const startFretDrag = ({ string, fret }, startX, startY) => {
  // real drag-and-drop logic will come in the next step
  let lastBeat = null, lastRow = null;
};


const mouseUp = e => {
  document.removeEventListener('mousemove', mouseMove);
  document.removeEventListener('mouseup',   mouseUp);

  const { beat, valid } = toGrid(e.clientX, e.clientY);

  /* cancel drop if the mouse never entered a valid grid cell */
  if (!valid) {
    setGhostNotes([]);
    ghostRef.current = [];
    setIsChordDragging(false);
    return;
  }

  /* extend the grid if we dropped beyond the current end */
  if (beat >= beats) {
    const extra = Math.floor(beat / BEATS_PER_MEASURE) + 1;
    setBeats(extra * BEATS_PER_MEASURE);
  }

  /* ── commit the chord ───────────────────────────────────── */
  const chordGhosts = ghostRef.current.slice();   // ⬅️  stable snapshot

  setSelectedNotes(prev => {
    /* 1️⃣  snapshot *before* mutating so Undo removes just this chord */
    pushHistory(prev);

    /* 2️⃣  drop any pills that collide with the chord on the same string */
    const keep = prev.filter(n =>
      !chordGhosts.some(g => {
        if (g.string !== n.string) return false;    // diff string → keep
        const g0 = g.beat,
              g1 = g.beat + (g.duration ?? 1) - 1,
              n0 = n.beat,
              n1 = n.beat + (n.duration ?? 1) - 1;
        return g1 >= n0 && g0 <= n1;                // overlap → drop
      })
    );

    /* 3️⃣  add the freshly-dropped chord */
    const added = chordGhosts.map(g => ({
      ...g,
      id: crypto.randomUUID(),
    }));

    return [...keep, ...added];
  });

  /* housekeeping */
  setGhostNotes([]);
  ghostRef.current = [];
  setIsChordDragging(false);
};


  /* kick off listeners + immediate first ghost */
  mouseMove({ clientX:startX, clientY:startY });
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('mouseup',   mouseUp);
};




  /* MENU ----------------------------------------------------- */
  const [menuInfo, setMenuInfo] = useState(null); // {…}|null
  const menuRef = useRef(null);

  // --- refs that help us restart playback cleanly if the grid grows ----
// --- refs that help us restart playback cleanly if the grid grows ----
const beatsAtPlayRef = useRef(beats);
const restartingRef  = useRef(false);

/* live chord-ghost during sidebar drag */
const ghostRef = useRef([]);             /* ← NEW */


  // start the loop slightly before the true end-point
  const LOOP_EARLY_MS = 70;    // ms jump-ahead (tweak to taste)

// ── playback-speed toggle ─────────────────────────
// UI labels (what the button shows)
const speedLabels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

// default index: label “1×”  → backend 2×
const [speedIdx, setSpeedIdx] = useState(3);

// internal multiplier is double the label
const playbackSpeed = speedLabels[speedIdx] * 2.4;


/* ── horizontal-zoom options ─────────────────────── */
const zoomOpts =	[0.2, 0.3, 0.5, 0.75, 1];
const cycleZoom = () => {
  setZoom(prev => zoomOpts[(zoomOpts.indexOf(prev) + 1) % zoomOpts.length]);
};

  
  const sustainOptions = [0.5, 1, 2, 4];
  const [sustainIdx, setSustainIdx] = useState(2);   // start at 2 s
    const noteDuration = sustainOptions[sustainIdx];


 /* ── note-length (beats) ───────────────────────────── */
/* 1 = eighth, 2 = quarter, 4 = half, 8 = whole */
/* ── note-length (beats) ───────────────────────────── */
/* 1 = eighth, 2 = quarter, 4 = half, 8 = whole */
const noteLenOptions = [1, 2, 4, 8];
const [noteLenIdx,   setNoteLenIdx] = useState(1);   // starts at Eighth
const noteLenBeats = noteLenOptions[noteLenIdx];     // ← RESTORED

  // top of App() with other refs
  const scrollRef = useRef(null);

// ─── wheel-/pinch-zoom parameters ──────────────────────────
const MIN_ZOOM   = 0.05;     // 20 %
const MAX_ZOOM   = 1.5;       // 200 %
const ZOOM_STEP  = 1.15;    // ≈15 % per wheel-notch

/* ──────────  ADD & EDIT NOTES  ──────────────────────────── */
const handleAddSelected = ({ string, fret }) => {
    pushHistory(selectedNotes);  /* overlap helper: does note `n` touch any beat in [start, end]? */
 
    const overlapsRange = (start, end, n) => {
    const nStart = n.beat;
    const nEnd   = n.beat + (n.duration ?? 1) - 1;
    return !(end < nStart || start > nEnd);     // ranges intersect
  };

  /* 1️⃣  find the earliest span of `noteLenBeats` empty beats */
  let insertionBeat = 0;
  while (true) {
    const spanEnd = insertionBeat + noteLenBeats - 1;
    const collides = selectedNotes.some(n =>
      overlapsRange(insertionBeat, spanEnd, n)
    );
    if (!collides) break;                       // we found a clear span
    insertionBeat += 1;                         // otherwise try next beat
  }

  /* 2️⃣  extend grid if needed (full-measure increments) */
  const lastNeededBeat = insertionBeat + noteLenBeats - 1;
  if (lastNeededBeat >= beats) {
    const extraMeasures =
      Math.floor(lastNeededBeat / BEATS_PER_MEASURE) + 1;
    setBeats(extraMeasures * BEATS_PER_MEASURE);
  }

  /* 3️⃣  commit the new note */
  setSelectedNotes(prev => [
    ...prev,
    {
      id: crypto.randomUUID(),
      string,
      fret,
      beat: insertionBeat,
      duration: noteLenBeats,
    },
  ]);

  /* 4️⃣  advance the cursor to the beat after this note */
  setCurrentBeat(insertionBeat + noteLenBeats);
};

/* ── insert a blank (silent) pill at the next free span ───────── */
const addBlankNote = () => {
  pushHistory(selectedNotes);  /* find first empty span of length noteLenBeats (same code as handleAdd…) */

  const overlaps = (s,e,n) => {
    const n0 = n.beat, n1 = n.beat + (n.duration ?? 1) - 1;
    return !(e < n0 || s > n1);
  };
  let beat = 0;
  while (selectedNotes.some(n => overlaps(beat, beat + noteLenBeats - 1, n)))
    beat++;

  /* grow grid if needed */
  const last = beat + noteLenBeats - 1;
  if (last >= beats) {
    const m = Math.floor(last / BEATS_PER_MEASURE) + 1;
    setBeats(m * BEATS_PER_MEASURE);
  }

  /* commit – string & fret can be placeholders; ‘silent’ flag tells playback to skip */
  setSelectedNotes(prev => [
    ...prev,
    { id: crypto.randomUUID(),
      string: 1,      /* top row – arbitrary */
      fret:   0,
      beat,
      duration: noteLenBeats,
      silent: true,   /* ← NEW flag */
    },
  ]);

  setCurrentBeat(beat + noteLenBeats);  /* advance cursor */
};


const handlePlayPill = (note) => {
  if (note.silent) return;  
  /* 🔄 sync sidebar filters */
  setStringIdx(note.string);
  setFret(note.fret);

  /* 1️⃣  play audio */
  playNote(note.string - 1, note.fret, noteDuration);

  /* 2️⃣  flash the pill on the note-board */
  setActiveIds(ids => new Set(ids).add(note.id));
  setTimeout(() => {
    setActiveIds(ids => {
      const next = new Set(ids);
      next.delete(note.id);
      return next;
    });
  }, note.duration * BEAT_MS);

  /* 3️⃣  flash the matching fret-button */
  const btn = document.querySelector(
    `.fret-btn[data-string="${note.string}"][data-fret="${note.fret}"]`
  );
  if (btn) {
    /* restart animation even on rapid re-clicks */
    btn.classList.remove('active');
    void btn.offsetWidth;
    btn.classList.add('active');

    /* clear & store timer so overlap never cancels a fresh flash */
    const timers = flashTimersRef.current;
    if (timers.has(btn)) clearTimeout(timers.get(btn));

    const tid = setTimeout(
      () => btn.classList.remove('active'),
      noteDuration * 1000               // honour sustain (sec → ms)
    );
    timers.set(btn, tid);
  }
};


const moveNote = (id, newBeat, newString) => {
  pushHistory(selectedNotes);
  setSelectedNotes(prev => {
    /* pull out the pill we’re moving */
    const moving = prev.find(n => n.id === id);
    if (!moving) return prev;                    // safety guard

    const dur   = moving.duration ?? 1;
    const start = newBeat;
    const end   = newBeat + dur - 1;

    /* keep only notes that DON’T collide with the drop-range on the same string */
    const remaining = prev.filter(n => {
      if (n.id === id) return false;             // drop the old copy of the moving pill
      if (n.string !== newString) return true;   // diff string → always keep

      /* range intersection test */
      const nStart = n.beat;
      const nEnd   = n.beat + (n.duration ?? 1) - 1;
      return end < nStart || start > nEnd;
    });

    /* commit moved pill */
    return [
      ...remaining,
      { ...moving, beat: newBeat, string: newString },
    ];
  });

  /* grow grid if we dropped beyond the current right edge */
  if (newBeat >= beats) {
    const extra = Math.floor(newBeat / BEATS_PER_MEASURE) + 1;
    setBeats(extra * BEATS_PER_MEASURE);
  }
};

  /* ──────────  CONTEXT-MENU HELPERS  ──────────────────────── */
const handleNoteClick = (note, x, y) => {
  setStringIdx(note.string);          // sync sidebar dropdowns
  setFret(note.fret);
  setMenuInfo({ mode: 'note', note, x, y });
};


const handleBgClick = ({ beat, row }, x, y, nativeEvt) => {
  // Ctrl-left-click anywhere on the grid → set start beat
  if (nativeEvt.ctrlKey && nativeEvt.button === 0) {
    setStartBeat(beat);
    return;                               // don’t open context-menu
  }

  /* regular empty-space click behaves as before                     */
  setMenuInfo({ mode: 'empty', beat, row, x, y });
};


  const deleteNote = (id) => {
    setSelectedNotes(prev => prev.filter(n => n.id !== id));
    setMenuInfo(null);
  };

  const changeFret = (note) => {
    const val = prompt('Enter new fret (0-24):', note.fret);
    if (val === null) return setMenuInfo(null);
    const nf = Number(val);
    if (isNaN(nf) || nf < 0 || nf > 24) return alert('Invalid fret');
    setSelectedNotes(prev =>
      prev.map(n => (n.id === note.id ? { ...n, fret: nf } : n))
    );
    setMenuInfo(null);
  };

  const addNoteAt = (beat, row) => {
    const val = prompt('Enter fret (0-24):', '0');
    if (val === null) return setMenuInfo(null);
    const f = Number(val);
    if (isNaN(f) || f < 0 || f > 24) return alert('Invalid fret');

    if (beat >= beats) {
      const m = Math.floor(beat / BEATS_PER_MEASURE) + 1;
      setBeats(m * BEATS_PER_MEASURE);
    }
    const string = row + 1;
    setSelectedNotes(prev => [
      ...prev,
      { id: crypto.randomUUID(), string, fret: f, beat, duration: 1 }
    ]);
    setMenuInfo(null);
  };

    /* ─── Eraser: delete a single note pill ─── */
const handleEraseNote = (id) => {
  pushHistory(selectedNotes);    setSelectedNotes(prev => prev.filter(n => n.id !== id));
}


/* ── wheel / pinch → horizontal zoom at cursor ───────────── */
useEffect(() => {
  const box = scrollRef.current;
  if (!box) return;

 const handleWheel = (e) => {
   /*  A.  ignore horizontal-only wheels / track-pad swipes  */
   if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

   /*  B.  treat any *vertical* wheel / swipe as zoom        */
   e.preventDefault();                       // block normal scroll / page zoom

    /* current pointer context */
    const { left }  = box.getBoundingClientRect();
    const cursorX   = e.clientX - left;                 // px in viewport
    const worldX    = (box.scrollLeft + cursorX) / zoom;// logical beat-px

    /* new zoom */
    const dir       = e.deltaY > 0 ? 1 : -1;            // wheel sign
    const nextZoom  = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom * (dir > 0 ? 1 / ZOOM_STEP : ZOOM_STEP))
    );

    /* keep beat under cursor fixed */
    const nextScroll = worldX * nextZoom - cursorX;

    /* commit */
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      // clamp inside scrollable range
      box.scrollLeft = Math.max(
        0,
        Math.min(box.scrollWidth - box.clientWidth, nextScroll)
      );
    });
  };

  box.addEventListener('wheel', handleWheel, { passive: false });
  return () => box.removeEventListener('wheel', handleWheel);
}, [zoom]);   // rerun if zoom ref changes



  /* close menu on outside-click */
  useEffect(() => {
    if (!menuInfo) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuInfo(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuInfo]);

  /* ──────────  PLAY / PAUSE / LOOP  ───────────────────────── */
  const [isPlaying, setIsPlaying] = useState(false);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  };

  const pausePlayback = () => {
    clearAllTimeouts();
    cancelAnimationFrame(playTimer.current);
    setActiveIds(new Set());
    setPlayheadProgress(null);
    setIsPlaying(false);
  };

  /* ── auto-restart playback if new measures were appended while looping ── */
useEffect(() => {
  if (!isPlaying) { restartingRef.current = false; return; }

  // grid grew while we’re playing
  if (beats > beatsAtPlayRef.current && !restartingRef.current) {
    restartingRef.current = true;        // avoid re-entrancy
    pausePlayback();                     // stop everything
    // slight micro-delay so React finishes state flush
    setTimeout(() => {
      restartingRef.current = false;
      playSelected();                    // restart from bar #1 including new notes
    }, 0);
  }
}, [beats, isPlaying]);                  // <── watches beat-count changes


/* ──────────────────────────────────────────────────────────
   PLAY / PAUSE  — respects startBeat marker
   ────────────────────────────────────────────────────────── */
const playSelected = () => {
  if (isPlaying || !selectedNotes.length) return;

  /* ——— timing constants ——— */
  const baseBeatMs   = 600;                      // 100 BPM reference
  const beatMs       = baseBeatMs / playbackSpeed;
  const visLag       = 100   / playbackSpeed;    // UI latency
  const start        = startBeat;                // user marker (≥ 0)
  const loopEarlyMs  = loopOn ? LOOP_EARLY_MS / playbackSpeed : 0;

  /* ——— pick only notes that can still be heard ——— */
  const playable = selectedNotes.filter(n =>
    !n.silent && n.beat + (n.duration ?? 1) - 1 >= start
  );
  if (!playable.length) return;

  const beatsRemaining = beats - start;
  const totalMs  = beatsRemaining * beatMs;
  const activeMs = totalMs - loopEarlyMs;

  /* ——— reset any previous run ——— */
  clearAllTimeouts();
  setActiveIds(new Set());
  cancelAnimationFrame(playTimer.current);
  beatsAtPlayRef.current = beats;
  setIsPlaying(true);

  /* ——— group notes by “local” beat (start ⇒ 0) ——— */
  const byBeat = {};
  for (const n of playable) {
    const local = n.beat - start;                // shift left
    (byBeat[local] ||= []).push(n);
  }

  /* ——— schedule note-ons / note-offs ——— */
  Object.entries(byBeat).forEach(([bStr, grp]) => {
    const beat      = Number(bStr);
    const baseStart = beat * beatMs;

    const ordered   = grp.sort((a, b) => b.string - a.string); // bass → treble
    const nStrings  = ordered.length;

    ordered.forEach((note, idx) => {
      const leadIn  = (nStrings - 1 - idx) * strumDelay;       // human strum
      const startMs = Math.max(0, baseStart - leadIn);
      const lenMs   = note.duration * beatMs;

      /* NOTE-ON */
      timeoutsRef.current.push(
        setTimeout(() => {
          setActiveIds(ids => new Set(ids).add(note.id));
          playNote(note.string - 1, note.fret, noteDuration);
        }, startMs)
      );

      /* NOTE-OFF */
      timeoutsRef.current.push(
        setTimeout(() => {
          setActiveIds(ids => {
            const next = new Set(ids);
            next.delete(note.id);
            return next;
          });
        }, startMs + lenMs)
      );
    });
  });

  /* ——— animate the red play-head & keep it in view ——— */
  const t0 = performance.now();
  const tick = () => {
    const elapsed = performance.now() - t0 - visLag;
    const p       = elapsed / activeMs;          // 0 … 1

    if (p >= 1) {
      pausePlayback();
      if (loopOn) playSelected();                // optional restart
      return;
    }

    setPlayheadProgress(p);

    const box = scrollRef.current;
    if (box) {
      const contentW  = box.scrollWidth;
      const viewW     = box.clientWidth;
      const x         = p * contentW;
      const buffer    = 40;
      const measurePx = (contentW / beatsRemaining) * BEATS_PER_MEASURE;

      if (x > box.scrollLeft + viewW - buffer) {
        box.scrollLeft = Math.min(contentW - viewW,
                                  box.scrollLeft + measurePx * 4);
      }
      if (x < box.scrollLeft + buffer) {
        box.scrollLeft = Math.max(0,
                                  box.scrollLeft - measurePx * 4);
      }
    }

    playTimer.current = requestAnimationFrame(tick);
  };

  /* kick everything off */
  scrollRef.current?.scrollTo({ left: 0 });      // jump view to marker
  setPlayheadProgress(0);
  playTimer.current = requestAnimationFrame(tick);
};






/* toggle between play and pause */
const handlePlayPause = () => {
  if (isPlaying) pausePlayback();
  else           playSelected();
};

/* sustain toggle */
const cycleSustain = () => {
  setSustainIdx((sustainIdx + 1) % sustainOptions.length);
};

/* ── strum-delay toggle (ms) ───────────────────────── */
const strumOptions = [0, 10, 20, 30, 40, 50, 60, 80, 100];
const [strumIdx, setStrumIdx] = useState(1);          // start at 20 ms
const strumDelay = strumOptions[strumIdx];            // replaces old state


const cycleStrum = () => {
  setStrumIdx((strumIdx + 1) % strumOptions.length);
};



  /* ──────────  CHORD-FILTER (unchanged)  ─────────────────── */
  const [grouped, setGrouped] = useState({ cats:{}, degreeInfo:[] });

useEffect(() => {
  /* ----- helpers ----- */
  const sIdx     = 6 - stringIdx;                     // 0 = low-E
  const melodyPC = (tuningMidi[sIdx] + fret) % 12;
  const scalePCs = buildScale(root, scaleType);

  /* ========================================================
     1)  LOAD  +  ORIGINAL FILTERS
     ------------------------------------------------------ */
  let shapes = loadAllShapes();

  // keep shapes that contain the melody pitch-class
  shapes = shapes.filter(p =>
    computePositionMidi(p).filter(Boolean).map(m => m % 12).includes(melodyPC)
  );

  // optionally enforce exact fret on the melody string
  if (exactPositionOnly) {
    shapes = shapes.filter(p => {
      const rel = p.frets[sIdx];
      const abs = rel > 0 ? p.baseFret + rel - 1 : 0;
      return abs === fret;
    });
  }

  // in-/out-of-scale  +  playability limit
 shapes = shapes.filter(p =>
   (showOutside ? !fitsScale(p, scalePCs) : fitsScale(p, scalePCs))
 );
  /* ========================================================
     2)  DEDUPE BEFORE MUTING
     ------------------------------------------------------ */
  {
    const seen = new Set();
    shapes = shapes.filter(p => {
  // add the suffix so “A9” and “A11” aren’t considered duplicates
  const key = p.frets.join(',') + '|' + (p.suffix ?? '');      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /* ========================================================
     3)  OPTIONAL “TRUNCATE NOTES ABOVE MELODY” & 2nd DEDUPE
     ------------------------------------------------------ */
  if (truncateHigher) {
    shapes = shapes
      .map(p => ({
        ...p,
        frets: p.frets.map((f, idx) => (idx > sIdx ? -1 : f)), // mute ↑
      }))
      .filter(
        p => p.frets.filter(f => f != null && f >= 0).length >= 3 // ≥3 notes
      );


  }

  /* ========================================================
     4)  GROUP BY KEY / DEGREE  →  state
     ------------------------------------------------------ */
  const notes       = TonalScale.get(`${root} ${scaleType}`).notes;
  const romanMajor  = ['I','II','III','IV','V','VI','VII'];
  const romanMinorN = ['I','II','III','IV','V','VI','VII'];

  const degreeInfo = notes.map((n, idx) => ({
    label : scaleType === 'minor' ? romanMinorN[idx] : romanMajor[idx],
    degree: n,
  }));

  const cats = {};
  degreeInfo.forEach(d => (cats[d.degree] = []));
  cats.Chromatic = [];

  shapes.forEach(p => (cats[p.key] || cats.Chromatic).push(p));

  setGrouped({ cats, degreeInfo });
},
// ───── dependencies ─────
[root, scaleType, stringIdx, fret,
 showOutside, exactPositionOnly, truncateHigher]
);


/* play all strings of a chord-shape */
const playChord = (shape) => {
  const DELAY_MS = 60;                          // fixed strum gap
  let offset = 0;

  shape.frets.forEach((rel, idx) => {
    if (rel == null || rel < 0) return;         // muted string

    const uiString = 6 - idx;                   // DB order → UI order
    const absFret  = rel > 0 ? shape.baseFret + rel - 1 : 0;

    /* schedule each string with offset */
    setTimeout(() => {
      playNote(uiString - 1, absFret, noteDuration);

      /* flash corresponding button */
      const btn = document.querySelector(
        `.fret-btn[data-string="${uiString}"][data-fret="${absFret}"]`
      );
if (btn) {
  /* —— restart the pulse —— */
  btn.classList.remove('active');
  void btn.offsetWidth;          // force reflow so animation can replay
  btn.classList.add('active');

  /* —— clear any previous timer for this button —— */
  const timers = flashTimersRef.current;
  if (timers.has(btn)) clearTimeout(timers.get(btn));

  /* —— remove .active after the full sustain (sec → ms) —— */
  const tid = setTimeout(
    () => btn.classList.remove('active'),
    noteDuration * 1000          // 4 s sustain → 4000 ms
  );
  timers.set(btn, tid);
}

    }, offset);

    offset += DELAY_MS;                         // next string 40 ms later
  });
};

const scalePCs = buildScale(root, scaleType);   // ← new

// ‣ info = { string: 1-6, fret: 0-24 }
function startFretDrag({ string, fret }, startX, startY) {
  const BW  = 72 * zoom;          // beat-width   (px, scaled by zoom)
  const RH  = 48;                 // row-height   (px)
  const box = scrollRef.current;  // scrollable note-grid
  if (!box) return;

  /* helper: page-coords → {beat,row,valid} */
  const toGrid = (x, y) => {
    const { left, top } = box.getBoundingClientRect();
    const relX = x - left + box.scrollLeft - 36; // 36-px gutter
    const relY = y - top;
    const beat = Math.floor(relX / BW);
    const row  = Math.floor(relY / RH);          // 0 = top string
    const valid =
      relX >= 0 && relY >= 0 &&
      beat >= 0 && beat < beats &&
      row  >= 0 && row  < 6;
    return { beat, row, valid };
  };

  /* remember the last cell so we don’t retrigger sound in the same spot */
  let lastBeat = null, lastRow = null;

  /* ── MOUSE-MOVE: update ghost + preview sound ────────────── */
  const mouseMove = e => {
    const { beat, row } = toGrid(e.clientX, e.clientY);

    /* build the translucent ghost pill */
    const ghosts = [{
      id      : 'ghost-note',
      string  : row + 1,               // UI strings are 1-based
      fret,
      beat,
      duration: noteLenBeats,
    }];
    ghostRef.current = ghosts;
    setGhostNotes(ghosts);

    /* 🎧 live audio preview – only when we enter a *new* cell */
    if (row !== lastRow || beat !== lastBeat) {
      if (row >= 0 && row < 6 && beat >= 0) {    // inside the grid
        playNote(row, fret, noteDuration);       // row = 0-based string-idx
      }
      lastRow  = row;
      lastBeat = beat;
    }
  };

  /* ── MOUSE-UP: commit the pill (existing code, unchanged) ── */
  const mouseUp = e => {
    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup',   mouseUp);

    const { beat, row, valid } = toGrid(e.clientX, e.clientY);
    if (!valid) { setGhostNotes([]); ghostRef.current = []; return; setIsChordDragging(false); }

    if (beat >= beats) {
      const extra = Math.floor(beat / BEATS_PER_MEASURE) + 1;
      setBeats(extra * BEATS_PER_MEASURE);
    }

    /* drop the pill, removing any overlap on the same string */
    setSelectedNotes(prev => [
      ...prev.filter(n =>
        !( n.string === row + 1 &&
           beat <= n.beat + (n.duration ?? 1) - 1 &&
           beat + noteLenBeats - 1 >= n.beat )
      ),
      {
        id      : crypto.randomUUID(),
        string  : row + 1,
        fret,
        beat,
        duration: noteLenBeats,
      },
    ]);

    setGhostNotes([]);
    setIsChordDragging(false);
  };

  /* kick things off */
  mouseMove({ clientX: startX, clientY: startY });
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('mouseup',   mouseUp);
}


/* ──────────  RENDER  ───────────────────────────────────── */
return (
  <div
    className="px-4"
    style={{ paddingTop: 'var(--gap-top-edge)', paddingBottom: '1rem' }}
  >
    {/* ────────── MAIN WORK-AREA + SIDEBAR ────────── */}
    <div
      style={{
        display: 'flex',
        gap: 'var(--gap-column)',
        alignItems: 'stretch',
        maxHeight: '93vh',
      }}
    >
      {/* ────────── MAIN COLUMN ────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
       

       {/* ───── transport / playback bar ───── */}
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: 'var(--gap-board-to-bar)',
    flexWrap: 'wrap',
  }}
>
  {/* play / pause */}
  <button className="accent-btn" onClick={handlePlayPause}>
    {isPlaying ? 'Pause ⏸' : 'Play ▶︎'}
  </button>

  {/* loop */}
  <button
    className="accent-btn"
    onClick={() => setLoopOn(!loopOn)}
    style={{ opacity: loopOn ? 1 : 0.25 }}
  >
    Loop 🔁
  </button>

  {/* speed */}
  <button
    className="accent-btn speed-btn"
    onClick={() => setSpeedIdx((speedIdx + 1) % speedLabels.length)}
  >
    {speedLabels[speedIdx]}× Speed
  </button>

  {/* sustain */}
  <button className="accent-btn speed-btn" onClick={cycleSustain}>
    {sustainOptions[sustainIdx]}s Sustain
  </button>

  {/* strum delay */}
  <button className="accent-btn speed-btn" onClick={cycleStrum}>
    {strumDelay} ms Strum Delay
  </button>

  {/* horizontal zoom – NEW, now inside the same flex row */}
  <button
    className="accent-btn speed-btn"
    onClick={cycleZoom}
    style={{ flexShrink: 0 }}   /* prevents stretching if the row wraps */
  >
{`${Math.round((zoom / ZOOM_BASE) * 100)}% Zoom`}
  </button>
</div>



        {/* ───── note-grid + string labels ───── */}
        <div
          style={{
            display: 'flex',
            marginBottom: 'var(--gap-bar-to-fret)',
          }}
        >
<div
  ref={scrollRef}
  className="note-scrollbox"
  style={{
    overflowX: 'auto',
    overflowY: 'hidden',   //  ← this line is hiding the arrow
      paddingTop: '12px',      // leaves space so nothing gets cut off

    maxWidth: '100%',
    paddingBottom: '8px',
    boxSizing: 'content-box',
  }}
>
            <SelectedNotesBoard
              notes={selectedNotes}

              /* NEW — start-beat flag */
              startBeat={startBeat}
              onSetStartBeat={setStartBeat}
              
              ghostNotes={ghostNotes}
              beats={beats}
              progress={playheadProgress}
              activeIds={activeIds}
              onPillPlay={handlePlayPill}
              onNoteClick={handleNoteClick}
              onBackgroundClick={handleBgClick}
              onMove={moveNote}
              eraseMode={eraseMode}
              onErase={handleEraseNote}
              zoom={zoom}
              disableHover={isChordDragging} 
            />
          </div>
        </div>


{/* NEW: fretboard-view controls */}
<div style={{ marginBottom: 'var(--gap-controls-to-fret)' }}>

<FretboardToolbar
  root={root}      setRoot={setRoot}
  scaleType={scaleType} setScaleType={setScaleType}
  noteLenIdx={noteLenIdx} setNoteLenIdx={setNoteLenIdx}
  noteLenOptions={noteLenOptions}
  zoom={zoom} setZoom={setZoom}

  eraseMode={eraseMode}           /* new */
  setEraseMode={setEraseMode}
   noteVisIdx={noteVisIdx} setNoteVisIdx={setNoteVisIdx}
   addBlankNote={addBlankNote}
  onUndo={undoStack.current.length ? handleUndo : null}   

   disableHover={isChordDragging}  


/>


</div>

        {/* Fretboard */}
<Fretboard
  numStrings={6}
  numFrets={12}
  setStringIndex={setStringIdx}
  setFret={setFret}
  height="13rem"
  onSelect={handleAddSelected}
  noteDuration={noteDuration}
  scalePCs={scalePCs}          /* ← passes [0,2,4,5,7,9,11] etc. */
  startNoteDrag={startFretDrag}   // ⬅ now safe
  noteVisMode={noteVisModes[noteVisIdx]}          /* keep this */


/>

      </div>

    {/* ───── RIGHT-HAND SIDEBAR (collapsible) ───── */}
<div
  style={{
    width: sidebarOpen ? '16em' : '2.5rem',   // ← narrower (≈ 224 px)
    transition: 'width 0.25s',
    overflow: 'hidden',
    position: 'relative',
  }}
>




  <ChordSidebar
    grouped={grouped}
   onStartDrag={startChordDrag}
    onQuickInsert={quickInsertChord}   
    root={root}                       //  ← restore

    scaleType={scaleType}
    setRoot={setRoot}
    setScaleType={setScaleType}
    stringIdx={stringIdx}
    setStringIdx={setStringIdx}
    fret={fret}
    setFret={setFret}
    showOutside={showOutside}
    setShowOutside={setShowOutside}
exactPositionOnly={exactPositionOnly}  setExactPositionOnly={setExactPositionOnly}
truncateHigher={truncateHigher}        setTruncateHigher={setTruncateHigher}  // NEW

    onPlayChord={playChord}
    sidebarOpen={sidebarOpen}
    toggleSidebar={() => setSidebarOpen(o => !o)}
  />
</div>

    </div>

    {/* Context-menu overlay (kept outside flex so z-index wins) */}
    {menuInfo && (
      <>
        <div className="fixed inset-0" style={{ zIndex: 1000 }} />
        <ContextMenu
          ref={menuRef}
          x={menuInfo.x}
          y={menuInfo.y}
          mode={menuInfo.mode}
          onDelete={() => deleteNote(menuInfo.note?.id)}
          onChangeFret={() => changeFret(menuInfo.note)}
          onAddNote={() => addNoteAt(menuInfo.beat, menuInfo.row)}
          onClose={() => setMenuInfo(null)}
        />
      </>
    )}
  </div>
);
}
