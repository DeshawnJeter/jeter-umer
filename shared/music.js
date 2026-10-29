// Bounded musical data only: no executable code, remote samples, or arbitrary URLs.
export const MUSIC_STYLES = Object.freeze({ calm: { name: 'Calm / ambient', minTempo: 60, maxTempo: 90 }, adventure: { name: 'Adventure', minTempo: 90, maxTempo: 120 }, arcade: { name: 'Arcade / energetic', minTempo: 110, maxTempo: 150 } });
export const MELODY_NOTES = Object.freeze(['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','G5','A5','R']);
export const BASS_NOTES = Object.freeze(['C2','D2','E2','F2','G2','A2','B2','C3','D3','E3','G3','A3','R']);
export function musicStyleOf(value) {
  const style = value ?? 'adventure';
  if (!Object.hasOwn(MUSIC_STYLES, style)) throw new Error('Unsupported music style');
  return style;
}
export function composeScore(style = 'adventure', seed = '') {
  musicStyleOf(style);
  const phrases = {
    calm: ['C4','R','E4','R','G4','R','E4','D4','A4','R','G4','R','E4','R','D4','R'],
    adventure: ['C4','E4','G4','R','A4','G4','E4','D4','F4','A4','C5','A4','G4','E4','D4','R'],
    arcade: ['C5','G4','C5','E5','R','D5','C5','G4','A4','C5','D5','E5','G5','E5','D5','R']
  };
  const offset = [...String(seed)].reduce((sum, c) => sum + c.codePointAt(0), 0) % 4 * 4;
  const melody = [...phrases[style].slice(offset), ...phrases[style].slice(0, offset)];
  return { style, tempo: style === 'calm' ? 76 : style === 'arcade' ? 132 : 104, waveform: style === 'arcade' ? 'square' : style === 'calm' ? 'sine' : 'triangle', melody, bass: ['C2','A2','F2','G2'], drums: style !== 'calm' };
}
export function validateScore(score) {
  const errors = [], fields = ['style','tempo','waveform','melody','bass','drums'];
  if (!score || typeof score !== 'object' || Array.isArray(score)) return ['Music score must be an object'];
  if (Object.keys(score).length !== fields.length || fields.some(key => !Object.hasOwn(score,key))) errors.push('Music score contains unexpected or missing fields');
  const style = typeof score.style === 'string' && Object.hasOwn(MUSIC_STYLES,score.style) ? MUSIC_STYLES[score.style] : null;
  if (!style) errors.push('Unsupported music style');
  if (!Number.isInteger(score.tempo) || !style || score.tempo < style.minTempo || score.tempo > style.maxTempo) errors.push('Tempo is outside the selected style range');
  if (!['sine','triangle','square'].includes(score.waveform)) errors.push('Unsupported instrument waveform');
  if (!Array.isArray(score.melody) || ![8,16,32].includes(score.melody.length) || score.melody.some(note => !MELODY_NOTES.includes(note)) || score.melody.every(note => note === 'R')) errors.push('Provide 8, 16 or 32 safe melody notes with audible notes');
  if (!Array.isArray(score.bass) || ![4,8].includes(score.bass.length) || score.bass.some(note => !BASS_NOTES.includes(note)) || score.bass.every(note => note === 'R')) errors.push('Provide 4 or 8 safe bass notes with audible notes');
  if (typeof score.drums !== 'boolean' || (score.style === 'calm' && score.drums !== false)) errors.push('Invalid rhythm choice; calm music has no drums');
  return errors;
}
