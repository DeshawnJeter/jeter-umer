export class GameAudio {
  constructor(config) { this.config = config; this.volume = config.volume; this.muted = !config.enabled; this.started = false; }
  async start() {
    if (this.started) { await this.context?.resume(); return; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) { this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.connect(this.context.destination); await this.context.resume(); }
    if (this.config.music && window.Tone) {
      await Tone.start(); this.musicGain = new Tone.Gain(0).toDestination();
      this.synth = new Tone.Synth().connect(this.musicGain); let index = 0;
      this.timer = setInterval(() => { this.synth.triggerAttackRelease(['C4', 'E4', 'G4', 'E4'][index++ % 4], '8n'); }, 450);
    }
    this.started = true; this.update();
  }
  update() { if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume; if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : this.volume * 0.3; }
  tone(frequency) {
    if (!this.context || this.muted) return;
    const oscillator = this.context.createOscillator(); const envelope = this.context.createGain();
    oscillator.frequency.value = frequency; envelope.gain.setValueAtTime(0.35, this.context.currentTime); envelope.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.16);
    oscillator.connect(envelope); envelope.connect(this.gain); oscillator.start(); oscillator.stop(this.context.currentTime + 0.18);
  }
  dispose() { clearInterval(this.timer); this.synth?.dispose(); this.musicGain?.dispose(); this.context?.close(); }
}
