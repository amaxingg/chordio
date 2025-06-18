import React, { useRef, useState, useEffect } from 'react';
import { playabilityScore } from '@logic/rank.js';
import { tuningMidi } from '@logic/constants.js';   // already used elsewhere

const melodyPc = (stringIdx, fret) =>
  (tuningMidi[6 - stringIdx] + fret) % 12;          // 6-idx → tuning array

/* ---------- helper functions & constants ------------------ */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const groupBySuffix = (s = '') => {
  if (['', 'major', 'maj', 'm', 'min', 'minor'].includes(s)) return 'basic';
  if (['7', 'maj7', 'm7'].includes(s) || /\b(?:9|11|13)\b/.test(s))
    return 'jazzy';
  if (s.startsWith('sus')) return 'suspended';
  return 'other';
};

const SUB_TITLES = {
  basic:      'Basic',
  jazzy:      'Jazzy',
  suspended:  'Suspended',
  other:      'Other',
};

/* render / priority order */
const SUB_ORDER = ['basic', 'jazzy', 'suspended', 'other'];

const fretString = (p) =>
  p.frets
    .map((f) => (f < 0 || f == null ? 'x' : f > 0 ? f + p.baseFret - 1 : 0))
    .join('-');

const isOpen = (p) => (p.baseFret ?? 1) === 1 && p.frets.some((f) => f === 0);

const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((p) => {
    const id = fretString(p);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export default function ChordSidebar({
  grouped,
  root, scaleType, setRoot, setScaleType,
  stringIdx, setStringIdx,
  fret, setFret,
  showOutside,       setShowOutside,
  exactPositionOnly, setExactPositionOnly,
    truncateHigher,          // NEW
  setTruncateHigher,       // NEW
  
  onPlayChord,
  onQuickInsert,          // NEW  onStartDrag,
  onStartDrag,            // ←  MISSING!  add this line
  sidebarOpen,
  toggleSidebar,
}) {
  /* ── hold-to-drag timer ─────────────── */
  const holdTimerRef = useRef(null);
  const [dragId, setDragId] = useState(null);



 /* NEW – degree order is simply I … VII (+ Chromatic) -------- */
 // 0‥11 of the note the user just picked on the fretboard
 const targetPc = melodyPc(stringIdx, fret);

 // find the matching Roman-degree index inside degreeInfo (0 → I, 1 → ii …)
 let startIdx = grouped.degreeInfo.findIndex(
   d => NOTE_NAMES.indexOf(d.degree) === targetPc
 );
 if (startIdx === -1) startIdx = 0;          // safety fallback

 // rotate I–VII so the chosen degree comes first
 const orderedRoots = [
   ...grouped.degreeInfo.slice(startIdx).map(d => d.degree),
   ...grouped.degreeInfo.slice(0, startIdx).map(d => d.degree),
   'Chromatic',
 ];
  

/* ---------- helper that returns “all-collapsed” map ---------- */
const buildCollapsedMap = () =>
  orderedRoots.reduce((acc, deg) => {
    const info  = grouped.degreeInfo.find(d => d.degree === deg);
    const title = info ? `${deg} – ${info.label}` : 'Chromatic';
    acc[title]  = true;                          // every section collapsed
    return acc;
  }, {});

/* state — initial mount = all collapsed */
const [collapsed, setCollapsed] = useState(buildCollapsedMap);

/* reset to all-collapsed whenever the key or scale changes */
useEffect(() => {
  setCollapsed(buildCollapsedMap());
}, [root, scaleType, grouped]);          // add import: React.useEffect at top




/* click-toggle (unchanged) */
const toggleBlock = label =>
  setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));










  const handleMouseDown = (chord, e) => {
    e.preventDefault();
    setDragId(fretString(chord));
    holdTimerRef.current = setTimeout(() => {
      onStartDrag && onStartDrag(chord, e.clientX, e.clientY);
      holdTimerRef.current = null;
      document.addEventListener('mouseup', () => setDragId(null), { once:true });
    }, 200);
  };
  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setDragId(null);
    }
  };

  if (!grouped?.degreeInfo?.length) return null;

  /* key / scale selector data */
  const comboOpts = NOTE_NAMES.flatMap((n) => [
    { label:`${n} Major`, value:`${n}|major` },
    { label:`${n} Minor`, value:`${n}|minor` },
  ]);



  /* ── UI ─────────────────────────────────────────────────── */
  return (
    <div style={{ position:'relative', height:'100%' }}>
{/* toggle pill – position & logic unchanged */}
<button
  onClick={toggleSidebar}
  className="sidebar-toggle"
  style={{
    position: 'absolute',
    top: '0.5rem',
    right: '0.75rem',          // stays clear of the scrollbar
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '50%',

    /* base colour still comes from your theme token */
    background: 'var(--accent)',
    color: '#fff',

    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',

    transform: 'none',   // no rotation – glyph itself shows the direction
    transition: 'transform .25s',
  }}
  title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
>
  {sidebarOpen ? '▸' : '◂'}
</button>





      {/* sidebar body */}
<aside
  className="sidebar-scroll"
  style={{
    opacity: sidebarOpen ? 1 : 0,
    pointerEvents: sidebarOpen ? 'auto' : 'none',
    transition: 'opacity .25s',

    width: '100%',
    height: '100%',
    overflowY: 'auto',          // ⬅️  bring back vertical scrolling
    background: 'var(--panel)',
    color: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
    padding: 16,
    boxSizing: 'border-box',
    fontSize: '0.9rem',
    fontFamily: '"Open Sans", sans-serif',
  }}
>

     
{/* header – its own line */}
<h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>
  Recommended&nbsp;Chords:
</h2>


    {/* filters */}
<div
  style={{
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }}
>
  {/* ⬆️ 1️⃣  Only-show-this-fret  (now on top) */}
  <label className="pill-toggle">
    <input
      type="checkbox"
      checked={exactPositionOnly}
      onChange={e => setExactPositionOnly(e.target.checked)}
    />
    <span>Only show chords on this fret</span>
  </label>

  {/* ⬇️ 2️⃣  Truncate-above-melody */}
  <label className="pill-toggle">
    <input
      type="checkbox"
      checked={truncateHigher}
      onChange={e => setTruncateHigher(e.target.checked)}
    />
    <span>Delete notes above melody</span>
  </label>

  {/* 3️⃣  Show-out-of-scale (unchanged) */}
  <label className="pill-toggle">
    <input
      type="checkbox"
      checked={showOutside}
      onChange={e => setShowOutside(e.target.checked)}
    />
    <span>Show out-of-scale chords</span>
  </label>
</div>



        {/* chord lists */}
        {orderedRoots.map(deg=>{
          const shapes = grouped.cats[deg]||[];
          if(!shapes.length) return null;
          const info   = grouped.degreeInfo.find(d=>d.degree===deg);
          const title  = info ? `${deg} – ${info.label}` : 'Chromatic';
          const buckets = shapes.reduce((acc,p)=>{
            const b = groupBySuffix(p.suffix==='major'?'':p.suffix??'');
            (acc[b] ||= []).push(p);
            return acc;
          }, {});


  /* first chord = first visible chord in UI order ------------- */
  let firstChord = null;
  for (const bucketKey of SUB_ORDER) {
    if (firstChord) break;                     // already found
    const cand = buckets[bucketKey];
    if (!cand?.length) continue;               // skip empty bucket

    firstChord = dedupe(
      cand.slice().sort((a, b) => {
        if (isOpen(a) && !isOpen(b)) return -1;
        if (!isOpen(a) && isOpen(b)) return 1;
        return playabilityScore(a) - playabilityScore(b);
      })
    )[0];
  }




   const isClosed = collapsed[title];   // “Tonic – …” etc.

          return (
            <section key={deg}
                     style={{ margin:'18px 0 20px',
                              borderTop:'1px solid rgba(255,255,255,.25)' }}>


{/* ─────────── DEGREE HEADER (now draggable) ─────────────── */}
<div
  className={`degree-header ${isClosed ? 'collapsed' : ''} ${dragId===fretString(firstChord)?'armed':''}`}
  onClick={() => firstChord && onPlayChord(firstChord)}                 /* tap to preview */
  onMouseDown={e => firstChord && handleMouseDown(firstChord, e)}       /* hold → drag */
  onMouseUp={cancelHold}
  onMouseLeave={cancelHold}
onContextMenu={(e) => {
  e.preventDefault();
  if (!firstChord) return;
  onPlayChord   && onPlayChord(firstChord);   // ▶︎  play
  onQuickInsert && onQuickInsert(firstChord); // ➕ insert
}}

>
  {/* left side: play arrow + title */}
  <div className="header-left">
    <span className="play-arrow breathe" />
    <span className="degree-title">{title}</span>
  </div>

  {/* right side: chevron — now blocks drag too */}
  <button
    className={`degree-chevron ${isClosed ? 'collapsed' : ''}`}
    onMouseDown={e => e.stopPropagation()}        /* prevent drag start */
    onClick={(e) => {
      e.stopPropagation();                        /* keep play & toggle separate */
      toggleBlock(title);
    }}
  >
    <svg className="chev-down" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 7l6 6 6-6" />
    </svg>
    <svg className="chev-up" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 13l6-6 6 6" />
    </svg>
  </button>
</div>







    {/* BODY -------------------------------------------------- */}
    <div className={`degree-body ${isClosed ? 'collapsed' : ''}`}>
    {Object.entries(SUB_TITLES).map(([bucket,label]) => {






                const sorted = (buckets[bucket]||[])
                  .slice()
                  .sort((a,b)=>{
                    if(isOpen(a)&&!isOpen(b)) return -1;
                    if(!isOpen(a)&&isOpen(b)) return 1;
                    return playabilityScore(a)-playabilityScore(b);
                  });
                const list = dedupe(sorted).slice(0,5);
                if(!list.length) return null;
                return (
                  <div key={bucket} style={{marginBottom:10}}>
                    <p style={{margin:'2px 0',fontWeight:600}}>{label}</p>
                    <ul style={{margin:'2px 0',padding:0,listStyle:'none'}}>
                      {list.map((p,i)=>{
                        const suf = p.suffix==='major'?'':p.suffix??'';
                        return (
                           <li
onContextMenu={(e) => {
  e.preventDefault();
  onPlayChord   && onPlayChord(p);   // ▶︎  play it immediately
  onQuickInsert && onQuickInsert(p); // ➕ drop it into the grid
}}

                            key={i}
                            onClick={()=>onPlayChord&&onPlayChord(p)}
                            onMouseDown={e=>handleMouseDown(p,e)}
                            onMouseUp={cancelHold}
                            onMouseLeave={cancelHold}
                            className={`chord-item ${dragId===fretString(p)?'armed':''}`}
                            title="Click or hold-and-drag"
                          >
  <span className="chord-label">{`${p.key}${suf}`}</span>
  <span className="chord-frets">{fretString(p)}</span>                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
    })}
    </div>
            </section>
          );
        })}
      </aside>
    </div>
  );
}
