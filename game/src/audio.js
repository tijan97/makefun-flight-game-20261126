// Synthesised WebAudio sounds: no audio files, everything is generated.
// The engine hum follows throttle, the wind follows speed, and events ring out.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call from the first key/click.
  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.started = true;
      this.buildEngine();
      this.buildWind();
    } catch (err) {
      this.ctx = null;
    }
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(low);
    low.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    // A slow propeller throb on top of the engine tone.
    const throb = ctx.createOscillator();
    throb.type = 'sine';
    throb.frequency.value = 11;
    const throbGain = ctx.createGain();
    throbGain.gain.value = 0.03;
    throb.connect(throbGain);
    throbGain.connect(this.engineGain);
    throb.start();
  }

  buildWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSource.start();
  }

  // Called every frame with the plane's live state.
  update(throttle, speed, flying) {
    if (!this.ctx || this.muted) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
      return;
    }
    const t = this.ctx.currentTime;
    const engineLevel = flying ? 0.05 + throttle * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.12, t, 0.1);
    const windLevel = flying ? Math.min(0.12, (speed / 220) * 0.12) : 0.0;
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + speed * 3, t, 0.2);
  }

  tone(freq, dur, type, level, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  ringChime() {
    this.tone(880, 0.35, 'sine', 0.16);
    this.tone(1318, 0.5, 'sine', 0.12, 0.07);
  }

  click() {
    this.tone(660, 0.08, 'square', 0.06);
  }

  landingJingle() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, i * 0.11));
  }

  crashSound() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.tone(70, 0.6, 'sine', 0.3);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
