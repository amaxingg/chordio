export function playabilityScore(position) {
  const fingers = position.fingers.filter(f => f > 0).length;
  const barres = position.barres?.length || 0;
  const fretted = position.frets.filter(f => f > 0);
  const spread = Math.max(...fretted) - Math.min(...fretted);
  return barres*4 + fingers + spread*0.5 + position.baseFret*0.2;
}
