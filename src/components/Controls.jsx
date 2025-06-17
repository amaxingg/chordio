// ui/src/components/Controls.jsx
import React from 'react';

export default function Controls({
  root, setRoot,
  scaleType, setScaleType,
  stringIdx, setStringIdx,
  fret, setFret,
  containsMode, setContainsMode,
  exactPositionOnly, setExactPositionOnly,
  maxPlayScore, setMaxPlayScore,
  showOutside, setShowOutside,
  strumDelay, setStrumDelay,              // NEW props
}) {
  const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">

      {/* ── Root selector ── */}
      <div>
        <label className="block font-medium">Root:</label>
        <select
          value={root}
          onChange={e => setRoot(e.target.value)}
          className="mt-1 w-full px-2 py-1 border rounded"
        >
          {notes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* ── Scale type ── */}
      <div>
        <label className="block font-medium">Scale:</label>
        <select
          value={scaleType}
          onChange={e => setScaleType(e.target.value)}
          className="mt-1 w-full px-2 py-1 border rounded"
        >
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
      </div>

      {/* ── String index ── */}
      <div>
        <label className="block font-medium">String (1–6):</label>
        <input
          type="number" min="1" max="6"
          value={stringIdx}
          onChange={e => setStringIdx(Number(e.target.value))}
          className="mt-1 w-full px-2 py-1 border rounded"
        />
      </div>

      {/* ── Fret ── */}
      <div>
        <label className="block font-medium">Fret (0–24):</label>
        <input
          type="number" min="0" max="24"
          value={fret}
          onChange={e => setFret(Number(e.target.value))}
          className="mt-1 w-full px-2 py-1 border rounded"
        />
      </div>

      {/* ── Toggles & sliders ── */}
      <fieldset className="space-y-3 border-t pt-3">

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={containsMode}
            onChange={e => setContainsMode(e.target.checked)}
            className="mr-2"
          />
          Contains note
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={exactPositionOnly}
            onChange={e => setExactPositionOnly(e.target.checked)}
            className="mr-2"
          />
          Exact position only
        </label>

        {/* Max playability slider */}
        <div>
          <label className="block font-medium">
            Max playability: {maxPlayScore}
          </label>
          <input
            type="range" min="0" max="20"
            value={maxPlayScore}
            onChange={e => setMaxPlayScore(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showOutside}
            onChange={e => setShowOutside(e.target.checked)}
            className="mr-2"
          />
          Show Non-Scale Chords
        </label>

      </fieldset>
    </div>
  );
}
