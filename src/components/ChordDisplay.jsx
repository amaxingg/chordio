// ui/src/components/ChordDisplay.jsx
import React from 'react';
import { playabilityScore } from '@logic/rank.js';

// Determine which bucket a suffix belongs to
function groupBySuffix(suffix) {
  if (
    !suffix ||
    suffix === 'major' ||
    suffix === 'maj' ||
    suffix === 'm' ||
    suffix === 'min' ||
    suffix === 'minor'
  ) {
    return 'basic';
  }
  if (
    suffix === '7' ||
    suffix === 'maj7' ||
    suffix === 'm7' ||
    /\b9\b/.test(suffix) ||
    /\b11\b/.test(suffix) ||
    /\b13\b/.test(suffix)
  ) {
    return 'jazzy';
  }
  if (suffix.startsWith('sus')) {
    return 'suspended';
  }
  return 'other';
}

// Human‐friendly titles for each bucket
const SUB_TITLES = {
  basic:     'Basic',
  jazzy:     'Jazzy',
  suspended: 'Suspended',
  other:     'Other'
};

export default function ChordDisplay({ grouped = {} }) {
  const { cats = {}, degreeInfo = [] } = grouped;

  // Helper: does this root have at least one Basic shape?
  const hasBasic = (root) => {
    const list = cats[root] || [];
    return list.some(p => {
      const s = p.suffix === 'major' ? '' : p.suffix;
      return ['', 'major','maj','m','min','minor'].includes(s);
    });
  };

  // Build the ordered list of roots: diatonic with Basic first, then the rest, then Chromatic
  const diatonicRoots = degreeInfo.map(d => d.degree);
  const withBasic    = diatonicRoots.filter(r => hasBasic(r));
  const withoutBasic = diatonicRoots.filter(r => !hasBasic(r));
  const orderedRoots = [...withBasic, ...withoutBasic, 'Chromatic'];

  return (
    <div>
      {orderedRoots.map(degree => {
        const shapes = cats[degree] || [];
        if (shapes.length === 0) return null;

        // Section header
        const info  = degreeInfo.find(d => d.degree === degree);
        const title = info
          ? `${degree} Chords – ${info.label}`
          : 'Chromatic Chords';

        // Bucket shapes by complexity
        const subgroups = shapes.reduce((acc, p) => {
          const suffix = p.suffix === 'major' ? '' : p.suffix;
          const bucket = groupBySuffix(suffix);
          if (!acc[bucket]) acc[bucket] = [];
          acc[bucket].push(p);
          return acc;
        }, {});

        return (
          <section key={degree} className="mb-6">
            <h2 className="text-xl font-bold mb-2">{title}</h2>

            {Object.entries(SUB_TITLES).map(([key, label]) => {
              const list = subgroups[key] || [];
              if (list.length === 0) return null;

              // Further group by root note under this bucket
              const byRoot = list.reduce((m, p) => {
                m[p.key] = m[p.key] || [];
                m[p.key].push(p);
                return m;
              }, {});

              return (
                <div key={key} className="mb-4">
                  <h3 className="text-lg font-semibold mb-1">{label}</h3>
                  {Object.entries(byRoot).map(([rootKey, poses]) => (
                    <div key={rootKey} className="mb-2">
                      <strong className="block ml-2">{rootKey}:</strong>
                      {poses.map((p, i) => {
                        const abs = p.frets
                          .map(f =>
                            f > 0 ? f + p.baseFret - 1
                            : f === 0 ? 0
                            : 'x'
                          )
                          .join('-');
                        const suffix = p.suffix === 'major' ? '' : p.suffix;
                        const name   = `${p.key}${suffix}`;
                        return (
                          <div key={i} className="ml-6 font-mono">
                            Shape {i + 1}: {name} – {abs} (score {playabilityScore(p).toFixed(1)})
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
