// Bounded musical data only: no executable code, remote samples, or arbitrary URLs.
export const MUSIC_STYLES = Object.freeze({
  calm: { name:'Calm / ambient', minTempo:60, maxTempo:90, tempo:76, instrument:'pad', waveform:'sine', drums:false, step:'4n' },
  adventure: { name:'Adventure', minTempo:90, maxTempo:120, tempo:104, instrument:'synth', waveform:'triangle', drums:true, step:'8n' },
  arcade: { name:'Arcade / energetic', minTempo:110, maxTempo:150, tempo:132, instrument:'synth', waveform:'square', drums:true, step:'8n' },
  chiptune: { name:'Chiptune / retro', minTempo:100, maxTempo:160, tempo:144, instrument:'synth', waveform:'square', drums:true, step:'8n' },
  lofi: { name:'Lo-fi / relaxed', minTempo:60, maxTempo:95, tempo:82, instrument:'piano', waveform:'triangle', drums:true, step:'8n' },
  mysterious: { name:'Mysterious', minTempo:55, maxTempo:85, tempo:68, instrument:'bell', waveform:'sine', drums:false, step:'4n' },
  cinematic: { name:'Cinematic', minTempo:70, maxTempo:110, tempo:88, instrument:'pad', waveform:'triangle', drums:true, step:'4n' },
  dance: { name:'Dance / electronic', minTempo:115, maxTempo:150, tempo:128, instrument:'fm', waveform:'square', drums:true, step:'8n' }
});
// Synthesized timbres, not sampled acoustic instruments. Parameters are trusted
// presets; a model can select an identifier but cannot supply node options/code.
export const MUSIC_INSTRUMENTS = Object.freeze({
  synth: { name:'Classic synth', engine:'synth', volume:-15, duration:'16n', envelope:{attack:0.015,decay:0.18,sustain:0.1,release:0.3} },
  piano: { name:'Piano-like keys', engine:'synth', waveform:'triangle', volume:-16, duration:'8n', envelope:{attack:0.003,decay:0.7,sustain:0.05,release:0.5} },
  bell: { name:'FM bells', engine:'fm', volume:-21, duration:'8n', harmonicity:3.01, modulationIndex:5, envelope:{attack:0.003,decay:0.8,sustain:0,release:0.8} },
  pluck: { name:'Plucked synth', engine:'synth', waveform:'triangle', volume:-16, duration:'16n', envelope:{attack:0.002,decay:0.22,sustain:0,release:0.12} },
  pad: { name:'Warm pad', engine:'synth', waveform:'sine', volume:-18, duration:'8n', envelope:{attack:0.08,decay:0.4,sustain:0.45,release:0.7} },
  organ: { name:'Organ-like synth', engine:'synth', waveform:'sine', volume:-20, duration:'8n', envelope:{attack:0.01,decay:0.05,sustain:0.7,release:0.12} },
  fm: { name:'FM lead', engine:'fm', volume:-21, duration:'16n', harmonicity:1.5, modulationIndex:2, envelope:{attack:0.008,decay:0.15,sustain:0.15,release:0.2} }
});
export const MELODY_NOTES = Object.freeze(['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','G5','A5','R']);
export const BASS_NOTES = Object.freeze(['C2','D2','E2','F2','G2','A2','B2','C3','D3','E3','G3','A3','R']);
export function musicStyleOf(value) {
  const style = value ?? 'adventure';
  if (!Object.hasOwn(MUSIC_STYLES, style)) throw new Error('Unsupported music style');
  return style;
}
export function instrumentOf(value, allowAuto = false) {
  const instrument = value ?? (allowAuto ? 'auto' : 'synth');
  if (!(allowAuto && instrument === 'auto') && !Object.hasOwn(MUSIC_INSTRUMENTS,instrument)) throw new Error('Unsupported music instrument');
  return instrument;
}
export function composeScore(style = 'adventure', seed = '', selectedInstrument = 'auto') {
  musicStyleOf(style);
  instrumentOf(selectedInstrument,true);
  const phrases = {
    calm: ['C4','R','E4','R','G4','R','E4','D4','A4','R','G4','R','E4','R','D4','R'],
    adventure: ['C4','E4','G4','R','A4','G4','E4','D4','F4','A4','C5','A4','G4','E4','D4','R'],
    arcade: ['C5','G4','C5','E5','R','D5','C5','G4','A4','C5','D5','E5','G5','E5','D5','R'],
    chiptune: ['C5','E5','G5','E5','D5','G4','B4','D5','A4','C5','E5','C5','G4','B4','D5','R'],
    lofi: ['E4','R','G4','A4','R','G4','E4','R','D4','F4','R','A4','G4','R','D4','R'],
    mysterious: ['A4','R','E4','R','B4','C5','R','A4','F4','R','E4','D4','R','B4','A4','R'],
    cinematic: ['C4','R','G4','R','A4','C5','R','G4','F4','A4','R','C5','G4','E4','D4','R'],
    dance: ['C5','R','G4','C5','E5','R','D5','G4','A4','R','C5','E5','G5','D5','C5','R']
  };
  const offset = [...String(seed)].reduce((sum, c) => sum + c.codePointAt(0), 0) % 4 * 4;
  const melody = [...phrases[style].slice(offset), ...phrases[style].slice(0, offset)];
  const preset=MUSIC_STYLES[style];
  return { style, tempo:preset.tempo, instrument:selectedInstrument === 'auto' ? preset.instrument : selectedInstrument, waveform:preset.waveform, melody, bass:style==='mysterious'?['A2','E2','F2','E2']:['C2','A2','F2','G2'], drums:preset.drums };
}
export function validateScore(score) {
  const errors = [], fields = ['style','tempo','waveform','melody','bass','drums'];
  if (!score || typeof score !== 'object' || Array.isArray(score)) return ['Music score must be an object'];
  if (Object.keys(score).some(key => ![...fields,'instrument'].includes(key)) || fields.some(key => !Object.hasOwn(score,key))) errors.push('Music score contains unexpected or missing fields');
  if (Object.hasOwn(score,'instrument')) { try { if (typeof score.instrument !== 'string') throw new Error('Invalid instrument'); instrumentOf(score.instrument); } catch { errors.push('Unsupported music instrument'); } }
  const style = typeof score.style === 'string' && Object.hasOwn(MUSIC_STYLES,score.style) ? MUSIC_STYLES[score.style] : null;
  if (!style) errors.push('Unsupported music style');
  if (!Number.isInteger(score.tempo) || !style || score.tempo < style.minTempo || score.tempo > style.maxTempo) errors.push('Tempo is outside the selected style range');
  if (!['sine','triangle','square'].includes(score.waveform)) errors.push('Unsupported instrument waveform');
  if (!Array.isArray(score.melody) || ![8,16,32].includes(score.melody.length) || score.melody.some(note => !MELODY_NOTES.includes(note)) || score.melody.every(note => note === 'R')) errors.push('Provide 8, 16 or 32 safe melody notes with audible notes');
  if (!Array.isArray(score.bass) || ![4,8].includes(score.bass.length) || score.bass.some(note => !BASS_NOTES.includes(note)) || score.bass.every(note => note === 'R')) errors.push('Provide 4 or 8 safe bass notes with audible notes');
  if (typeof score.drums !== 'boolean' || (['calm','mysterious'].includes(score.style) && score.drums !== false)) errors.push('Invalid rhythm choice; calm and mysterious music have no drums');
  return errors;
}
