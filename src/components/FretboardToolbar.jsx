import React from 'react';

/* helper – capitalise first letter (“major” → “Major”) */
const cap = s => s[0].toUpperCase() + s.slice(1);

export default function FretboardToolbar({
  /* combined key / scale */
  root,            setRoot,
  scaleType,       setScaleType,

  /* note-length (beats) toggle */
  noteLenIdx,      setNoteLenIdx,
  noteLenOptions,

  /* 🩹 Eraser toggle */
  eraseMode,       setEraseMode,

  /* 👁  3-state visibility toggle */
  noteVisIdx,      setNoteVisIdx,
  addBlankNote,                    /* NEW */
}) {
  /* ── data ───────────────────────────────────────────── */
  const ROOTS  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const MODES  = ['major','minor'];

  const combos = ROOTS.flatMap(r =>
    MODES.map(m => ({
      id   : `${r}|${m}`,
      label: `${r} ${cap(m)}`,
    })),
  );

  /* labels for the 3-state pill */
  const visLabels = [
    'Show out-of-scale notes',
    'Show in-scale notes only',
    'Hide all notes',
  ];

  /* ── render ─────────────────────────────────────────── */
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: 'var(--gap-controls-to-fret)',
        flexWrap: 'wrap',
      }}
    >

      {/* Key / Scale dropdown */}
      <select
        className="accent-btn speed-btn px-3 py-2 cursor-pointer"
        value={`${root}|${scaleType}`}
        onChange={e => {
          const [newRoot, newScale] = e.target.value.split('|');
          setRoot(newRoot);
          setScaleType(newScale);
        }}
      >
        {combos.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>


      {/* 3-state visibility pill */}
      <button
        className="accent-btn speed-btn"
        onClick={() => setNoteVisIdx((noteVisIdx + 1) % 3)}
      >
        {visLabels[noteVisIdx]}
      </button>

      {/* Note-length dropdown */}
      <select
        className="accent-btn speed-btn len-btn px-3 py-2 cursor-pointer"
        value={noteLenIdx}
        onChange={e => setNoteLenIdx(Number(e.target.value))}
      >
        {noteLenOptions.map((beats, idx) => (
          <option key={idx} value={idx}>
            {{
              1: 'Eighth Note',
              2: 'Quarter Note',
              4: 'Half Note',
              8: 'Whole Note',
            }[beats]}
          </option>
        ))}
      </select>

{/* Insert Blank pill */}
<button
  className="accent-btn speed-btn"
  onClick={addBlankNote}
>
  Add Pause
</button>


     {/* ── Eraser pill ── */}
<button
  className="accent-btn speed-btn"
  onClick={() => setEraseMode(!eraseMode)}
  style={{ opacity: eraseMode ? 1 : 0.25 }}   // ← identical logic to “Loop”
>
Eraser 🩹 
</button>



    </div>
  );
}
