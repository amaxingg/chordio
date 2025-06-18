// src/components/SelectedNotesBoard.jsx
import React, { useRef, useEffect, useState } from 'react';
import './selected-notes.css';

export default function SelectedNotesBoard({
  notes = [],
  ghostNotes = [],

  beats = 4,
  progress = null,
  activeIds = new Set(),
  showLabels = true,
  /* NEW – where playback should begin */
  startBeat = 0,
  onSetStartBeat = () => {},      //  <-- ADD THIS PROP

  /* callbacks */
  onPillPlay = () => {},
  onNoteClick = () => {},
  onBackgroundClick = () => {},
  onMove = () => {},

  /* 🩹 eraser support */
  eraseMode = false,          // ← NEW
  onErase   = () => {},       // ← NEW
  zoom = 1,
}) {




/* ── geometry ──────────────────────────────────────── */
const bw   = 72 * zoom;   // width scales
const rh   = 48;          // height fixed
const pad  = 8;           // padding fixed

const pillH= rh - pad;    // pill height unchanged
const W    = beats * bw;  // board width still scales


  const strings = ['e','B','G','D','A','E'];

/* ── refs ────────────────────────────────────────── */
const boardRef     = useRef(null);          // main scrollable board
const topScrollRef = useRef(null);          // NEW – dummy bar on top
const armTimerRef  = useRef(null);          // 200 ms hold-to-drag
const dragRef      = useRef(null);
const mouseDownRef = useRef(null);

  const lastRowRef   = useRef(null);
const [ghost, setGhost] = useState(null);

/* helper: page-X  ➜  beat index ------------------------------------*/
const xToBeat = x => {
  const { left } = boardRef.current.getBoundingClientRect();
  return Math.max(0, Math.floor((x - left) / bw));
};

/* 🔴 pill under the eraser cursor */
const [deleteHoverId, setDeleteHoverId] = useState(null);

  /* handy helper: clear & NULL the hold timer                */
  const cancelHoldTimer = () => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;      //  ← ***important***
    }
  };

  /* ── global mousedown / up → single source of truth ───── */
useEffect(() => {
  const down = () => {
    mouseDownRef.current = true;
  };

  const up = e => {
    mouseDownRef.current = false;

    // ——— If a drag is active, finalise the move ———
    if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      const pos = pointToGrid(
        e.clientX - offsetX,
        e.clientY - offsetY
      );
      onMove(id, pos.beat, pos.row + 1); // commit

      dragRef.current = null;            // clear drag state
      setGhost(null);                    // hide ghost
      window.removeEventListener('mousemove', handleMove); // remove listener
    }

    cancelHoldTimer();                   // always clear the 200 ms timer
  };

  window.addEventListener('mousedown', down);
  window.addEventListener('mouseup',   up);
  return () => {
    window.removeEventListener('mousedown', down);
    window.removeEventListener('mouseup',   up);
  };
}, [beats, notes.length, zoom]);

/* ── sync top-bar ↔︎ board scrollbar ─────────────────────── */
useEffect(() => {
  const top    = topScrollRef.current;
  const bottom = boardRef.current;
  if (!top || !bottom) return;

  const syncFromTop    = () => (bottom.scrollLeft = top.scrollLeft);
  const syncFromBottom = () => (top.scrollLeft    = bottom.scrollLeft);

  top.addEventListener   ('scroll', syncFromTop);
  bottom.addEventListener('scroll', syncFromBottom);

  return () => {
    top.removeEventListener   ('scroll', syncFromTop);
    bottom.removeEventListener('scroll', syncFromBottom);
  };
}, []);


  /* screen-point → beat,row */
  const pointToGrid = (x, y) => {
    const { left, top } = boardRef.current.getBoundingClientRect();
    const beat = Math.max(0, Math.floor((x - left) / bw));
    const row  = Math.max(0, Math.min(5, Math.floor((y - top)  / rh)));
    return { beat, row };
  };

  /* hold-to-drag logic */
const startDrag = (id, offX, offY, startX, startY) => {
  const original = notes.find(n => n.id === id);
  dragRef.current = {
    id,
    offsetX: offX,
    offsetY: offY,
    duration: original?.duration ?? 1,
  };
  lastRowRef.current = null;

  // initial ghost
  const first = pointToGrid(startX - offX, startY - offY);
  setGhost({ id, ...first, duration: dragRef.current.duration });

  // live preview + ghost follow
  const handleMove = e => {
    if (!dragRef.current) return;
    const pos = pointToGrid(
      e.clientX - dragRef.current.offsetX,
      e.clientY - dragRef.current.offsetY
    );

    if (pos.row !== lastRowRef.current) {
      lastRowRef.current = pos.row;
      if (original) {
        onPillPlay({
          ...original,
          string: pos.row + 1,
          beat: pos.beat,
        });
      }
    }
    setGhost({ id, ...pos, duration: dragRef.current.duration });
  };

  window.addEventListener('mousemove', handleMove);
};

  /* ── JSX ─────────────────────────────────────────────── */
  return (
    <div
      ref={boardRef}
      className="sn-board"
    style={{ width: W, height: rh * 6, position:'relative' }}
    
  /* NEW — Ctrl-left-click empty space sets start-beat */
  onClick={e => {
    if (e.ctrlKey && !e.target.closest('.sn-note')) {        // empty grid cell
      const { beat, row } = pointToGrid(e.clientX, e.clientY);
      onBackgroundClick({ beat, row }, e.clientX, e.clientY, e);
    }
  }}

      onContextMenu={e => {
        if (e.target.closest('.sn-note')) return;
        e.preventDefault();
        const { beat, row } = pointToGrid(e.clientX, e.clientY);
        onBackgroundClick({ beat, row }, e.clientX, e.clientY, e);
      }}
    >
      {/* zebra rows */}
{/* per-string tinted rows – light version of each pill colour */}
{strings.map((_, i) => (
  <div
    key={i}
    className="row-tint"
    style={{
      top: i * rh,                // <-- still the correct Y offset
      '--row-col': `var(--s${6 - i})`,  // e-string gets var(--s6) (purple) …
    }}
  />
))}


      {/* grid lines */}
      {strings.map((_, i) => (
        <div key={i} className="sn-line" style={{ top:(i+1)*rh }} />
      ))}
{/* draw a faint band _behind_ every full measure */}
{Array.from({ length: Math.ceil(beats / 8) }).map((_, bar) => (
  <div
    key={`band-${bar}`}
    className="sn-measure-band"
    style={{ left: bar * 8 * bw, width: 8 * bw }}
  />
))}

{/* grid lines */}
{Array.from({ length: beats + 1 }).map((_, i) => {
  /* “local” index inside the current 8-beat measure */

  
    const local = i % 8;                      // 0‥7 inside the current bar

  const cls =
    local === 0 ? 'sn-measure' :            // full bar
    local === 4 ? 'sn-half'    :            // half bar
    local % 2   ? 'sn-eighth'  : 'sn-quarter';
                  
  return (
    <div key={i} className={cls} style={{ left: i * bw }} />
  );
})}


{/* play-head ------------------------------------------------ */}
{progress !== null && (
  <div
    className="sn-playhead"
    style={{
      /* left = (startBeat + progress·remaining) × bw */
      left: (startBeat + progress * (beats - startBeat)) * bw,
    }}
  />
  
)}


{/* ── START-BEAT MARKER & FLAG ───────────────────────── */}
<>
  {/* thin vertical guideline – only if marker isn’t at beat 0 */}
  {startBeat !== 0 && (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: startBeat * bw,
        width: 1,
        background: '#14b8a650',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )}

 {/* draggable arrow */}
<div
  onMouseDown={(e) => {
    e.stopPropagation();
    const move = (ev) => onSetStartBeat(xToBeat(ev.clientX));
    const up   = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
  }}
  style={{
    position: 'absolute',
    top: -14,                       // a little higher so the bigger arrow clears the grid
    left: startBeat * bw - 9,       // (½ of new base width)
    width: 0,
    height: 0,
    /* ▼  bigger  & brighter */
    borderLeft : '9px solid transparent',
    borderRight: '9px solid transparent',
    borderTop  : '12px solid #0fc4af',   // thicker triangle & slightly lighter teal
    cursor: 'col-resize',
    zIndex: 6,
    opacity: startBeat === 0 ? 0.85 : 1, // less transparency when at beat 0
    transition: 'left .15s, opacity .15s',
  }}
/>

</>






      {/* drag ghost */}
      {ghost && (
        <div
          className="sn-note drag-ghost"
          style={{
            top: ghost.row*rh + pad/2,
            left:ghost.beat*bw + 2,
width: ghost.duration * bw - 4,
            height:pillH,
            lineHeight:`${pillH}px`,
            '--pill-col': `var(--s${6-ghost.row})`,
          }}
        >
          {notes.find(n=>n.id===ghost.id)?.fret ?? ''}
        </div>
      )}

      {/* NOTE PILLS */}
{[...notes, ...ghostNotes].map(n => {
  if (ghost && n.id === ghost.id) return null;

/* ── BLANK pill spans all 6 strings ─────────────────── */
if (n.silent) {
  const left  = n.beat * bw + 2;
  const width = n.duration * bw - 4;
  return (
    <div
      key={n.id}
      className={`sn-blank ${
        eraseMode && n.id === deleteHoverId ? 'delete-hover' : ''
      }`}
      style={{
        top:   pad / 2,              // very top
        left,
        width,
        height: rh * 6 - pad,        // full board height
      }}
      /* —— Eraser-mode interactions —— */
      onMouseEnter={() => {
        if (eraseMode) setDeleteHoverId(n.id);
      }}
      onMouseLeave={() => {
        if (eraseMode) setDeleteHoverId(null);
      }}
      onClick={() => {
        if (eraseMode) onErase(n.id);
      }}
      /* —— normal context-menu —— */
      onContextMenu={e => {
        e.preventDefault();
        onNoteClick?.(n, e.clientX, e.clientY);
      }}
    />
  );
}

  /* ── sounding pill (old code) ───────────────────────── */
  const top   = (n.string - 1) * rh + pad / 2;
  const left  =  n.beat  * bw + 2;
  const width =  n.duration * bw - 4;
  const pillCol = `var(--s${7 - n.string})`;


        return (
          <div
            key={n.id}
  className={`sn-note
${activeIds.has(n.id)        ? 'active'       : ''}
${n.id.startsWith('ghost-')   ? 'drag-ghost'  : ''}
${n.id===deleteHoverId && eraseMode ? 'delete-hover' : ''}`
}
            style={{
              top, left, width,
              height:pillH, lineHeight:`${pillH}px`,
              '--pill-col': pillCol,
            }}
            /* hover-preview while button held */
/* HOVER behaviour */
onMouseEnter={() => {
  if (eraseMode) {
    setDeleteHoverId(n.id);            /* highlight red */
    return;
  }
  if (
    mouseDownRef.current &&
    !dragRef.current &&
    !armTimerRef.current
  ) {
    onPillPlay(n);                     /* normal preview */
  }
}}

onClick={() => {
  if (eraseMode) { onErase(n.id); return; }   /* 🗑 delete */
  if (!dragRef.current) onPillPlay(n);        /* normal play */
}}

            /* hold-to-drag */
            onMouseDown={e => {
              if (e.button!==0) return;
              const { left:x, top:y } = e.currentTarget.getBoundingClientRect();
              const offX = e.clientX - x;
              const offY = e.clientY - y;
              armTimerRef.current = setTimeout(
  () => {
    /* if the button is no longer held, ignore the timer */
    if (mouseDownRef.current) {
      startDrag(n.id, offX, offY, e.clientX, e.clientY);
    }
  },                200
              );
            }}
            onMouseMove={cancelHoldTimer}
onMouseLeave={() => {
  cancelHoldTimer();
  if (eraseMode) setDeleteHoverId(null);   /* remove red highlight */
}}            onContextMenu={e => {

              e.preventDefault();
              onNoteClick(n, e.clientX, e.clientY);
            }}
          >
            {n.fret}
          </div>
        );
      })}

      {/* string labels */}
      {showLabels && strings.map((lbl,i)=>(
        <div
          key={lbl}
          className="sn-label"
          style={{
            top:i*rh+rh/2,
            transform:'translate(-10px,-50%)',
            textAlign:'right'
          }}
        >
          {lbl}
        </div>
      ))}
    </div>
  );
}
