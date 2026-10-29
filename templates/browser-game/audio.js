import { composeScore, validateScore, instrumentOf, MUSIC_INSTRUMENTS, MUSIC_STYLES } from './score.js';
const safeVolume = value => Number.isFinite(value) ? Math.max(0, Math.min(0.3, value)) : 0;
export class GameAudio {
  constructor(config, { Tone = globalThis.Tone, AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.config = config; this.Tone = Tone; this.AudioContextCtor = AudioContextCtor;
    this.score = config.score || composeScore();
    const errors = validateScore(this.score); if (errors.length) throw new Error(errors.join('; '));
    this.instrument = instrumentOf(this.score.instrument);
    this.musicVolume = 1; this.sfxVolume = 1; this.musicMuted = false; this.sfxMuted = false;
    this.volume = safeVolume(config.volume); this.muted = !config.enabled; this.started = false; this.playing = false; this.disposed = false; this.nodes = []; this.sequences = []; this.scheduledNotes = 0;
  }
  async start() {
    if (this.disposed) throw new Error('Audio session disposed');
    if (this.started) { await this.context?.resume(); return; }
    if (this.starting) return this.starting;
    this.starting = this.initialize().catch(error => { this.clearMusic(); throw error; }).finally(() => { this.starting = null; });
    return this.starting;
  }
  async initialize() {
    if (!this.context && this.AudioContextCtor) {
      this.context = new this.AudioContextCtor(); this.gain = this.context.createGain(); this.gain.connect(this.context.destination);
    }
    await this.context?.resume();
    if (this.disposed) throw new Error('Audio session disposed');
    if (this.config.music && this.Tone) {
      const T = this.Tone; await T.start();
      if (this.disposed) throw new Error('Audio session disposed');
      const own = node => { this.nodes.push(node); return node; };
      this.limiter = own(new T.Limiter(-12)).toDestination();
      this.musicGain = own(new T.Gain(0)).connect(this.limiter);
      const preset = MUSIC_INSTRUMENTS[this.instrument];
      const Voice = preset.engine === 'fm' ? T.FMSynth : T.Synth;
      const voiceOptions = { volume:preset.volume, oscillator:{type:preset.waveform || this.score.waveform}, envelope:{...preset.envelope}, ...(preset.engine === 'fm' ? {harmonicity:preset.harmonicity,modulationIndex:preset.modulationIndex,modulation:{type:'sine'},modulationEnvelope:{attack:0.01,decay:0.2,sustain:0.1,release:0.3}} : {}) };
      this.lead = own(new Voice(voiceOptions)).connect(this.musicGain);
      this.bass = own(new T.Synth({ volume: -19, oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.15, release: 0.4 } })).connect(this.musicGain);
      this.transport = T.getTransport(); this.transport.bpm.value = this.score.tempo;
      const sequence = (voice, notes, interval, duration) => {
        const seq = new T.Sequence((time, note) => {
          if (note !== 'R' && this.playing && !this.disposed) { voice.triggerAttackRelease(note, duration, time); this.scheduledNotes++; }
        }, notes, interval).start(0);
        this.sequences.push(seq);
      };
      sequence(this.lead, this.score.melody, MUSIC_STYLES[this.score.style].step, preset.duration); sequence(this.bass, this.score.bass, '2n', '4n');
      if (this.score.drums) {
        this.drum = own(new T.MembraneSynth({ volume: -25, pitchDecay: 0.025, octaves: 3 })).connect(this.musicGain);
        const pattern = this.score.style === 'dance' ? ['C2','C2','C2','C2'] : this.score.style === 'lofi' ? ['C2','R','R','C2','R','R','C2','R'] : ['C2','R','C2','R'];
        sequence(this.drum, pattern, this.score.style === 'lofi' ? '8n' : '4n', '16n');
      }
    }
    this.started = true; this.update();
  }
  setPlaying(playing) {
    if (this.disposed || !this.started) return;
    this.playing = !!playing;
    this.update();
    if (!this.transport) return;
    if (this.playing && this.transport.state !== 'started') this.transport.start();
    if (!this.playing && this.transport.state !== 'stopped') this.transport.stop();
  }
  update() {
    this.volume = safeVolume(this.volume);
    this.musicVolume = Number.isFinite(this.musicVolume) ? Math.max(0, Math.min(1, this.musicVolume)) : 0;
    this.sfxVolume = Number.isFinite(this.sfxVolume) ? Math.max(0, Math.min(1, this.sfxVolume)) : 0;
    if (this.gain) this.gain.gain.value = this.muted || this.sfxMuted ? 0 : this.volume * this.sfxVolume;
    if (this.musicGain) this.musicGain.gain.rampTo(!this.playing || this.muted || this.musicMuted ? 0 : this.volume * 0.55 * this.musicVolume, 0.05);
  }
  tone(frequency) {
    if (!this.context || this.muted || this.sfxMuted || this.sfxVolume === 0 || this.disposed || !Number.isFinite(frequency) || frequency < 100 || frequency > 2000) return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.frequency.value = frequency; envelope.gain.setValueAtTime(0.35, this.context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.16);
    oscillator.connect(envelope); envelope.connect(this.gain); oscillator.start(); oscillator.stop(this.context.currentTime + 0.18);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  clearMusic() {
    this.playing = false; this.transport?.stop();
    for (const sequence of this.sequences) sequence.dispose(); this.sequences = [];
    for (const node of this.nodes.reverse()) node.dispose(); this.nodes = []; this.musicGain = null; this.transport = null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clearMusic(); this.context?.close()?.catch(() => {}); this.started = false;
  }
  inspect() { return { started: this.started, playing: this.playing, music: !!this.musicGain, style: this.score.style, instrument: this.instrument, tempo: this.score.tempo, scheduledNotes: this.scheduledNotes }; }
}
