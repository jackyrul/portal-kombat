// Fully procedural sound: WebAudio synthesis, no assets.

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.musicNodes = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _noise(dur) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * dur, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _env(gain, t0, peak, dur, curve = 4) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  punch(heavy = false) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    // thump
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(heavy ? 140 : 190, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const og = this.ctx.createGain();
    this._env(og, t, heavy ? 0.9 : 0.6, 0.14);
    osc.connect(og).connect(this.master);
    osc.start(t); osc.stop(t + 0.16);
    // smack
    const n = this._noise(0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = heavy ? 900 : 1400; f.Q.value = 0.8;
    const ng = this.ctx.createGain();
    this._env(ng, t, heavy ? 0.5 : 0.35, 0.1);
    n.connect(f).connect(ng).connect(this.master);
    n.start(t);
  }

  whoosh() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const n = this._noise(0.22);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
  }

  block() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g = this.ctx.createGain();
    this._env(g, t, 0.22, 0.09);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.1);
  }

  special(effect) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const freqs = { burn: [200, 90], freeze: [900, 1900], shock: [1300, 300], acid: [500, 160] };
    const [f0, f1] = freqs[effect] ?? [400, 200];
    const osc = this.ctx.createOscillator();
    osc.type = effect === 'shock' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.3);
    const g = this.ctx.createGain();
    this._env(g, t, 0.3, 0.32);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.35);
    const n = this._noise(0.3);
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = effect === 'freeze' ? 3400 : 800;
    const ng = this.ctx.createGain();
    this._env(ng, t, 0.14, 0.3);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t);
  }

  hitHurt() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);
    const g = this.ctx.createGain();
    this._env(g, t, 0.25, 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.18);
  }

  gong() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    for (const [freq, amp, dur] of [[96, 0.7, 2.4], [144, 0.4, 2.0], [192, 0.28, 1.6], [301, 0.14, 1.2]]) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t); osc.stop(t + dur + 0.1);
    }
  }

  ko() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 1.1);
    this.gong();
  }

  announce(text) {
    // deep-pitched announcer via speech synthesis, degrades silently
    try {
      if (this.muted || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.82; u.pitch = 0.1; u.volume = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* no announcer available */ }
  }

  startMusic() {
    if (!this.ensure() || this.musicNodes) return;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.16;
    bus.connect(this.master);

    // ominous drone
    const drone = ctx.createOscillator();
    drone.type = 'sawtooth'; drone.frequency.value = 55;
    const droneF = ctx.createBiquadFilter();
    droneF.type = 'lowpass'; droneF.frequency.value = 220; droneF.Q.value = 4;
    const droneG = ctx.createGain(); droneG.gain.value = 0.5;
    drone.connect(droneF).connect(droneG).connect(bus);
    drone.start();
    const drone2 = ctx.createOscillator();
    drone2.type = 'sawtooth'; drone2.frequency.value = 55.7;
    drone2.connect(droneF);
    drone2.start();

    // slow LFO on the filter for movement
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 130;
    lfo.connect(lfoG).connect(droneF.frequency);
    lfo.start();

    // percussion loop
    const tick = () => {
      if (!this.musicNodes) return;
      const t = ctx.currentTime;
      const step = this.musicNodes.step++;
      if (step % 4 === 0) { // deep drum
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(80, t);
        o.frequency.exponentialRampToValueAtTime(35, t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.25);
      }
      if (step % 8 === 6) { // metallic tap
        const n = this._noise(0.08);
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 5000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        n.connect(f).connect(g).connect(bus); n.start(t);
      }
      this.musicNodes.timer = setTimeout(tick, 210);
    };

    this.musicNodes = { bus, stops: [drone, drone2, lfo], step: 0, timer: null };
    tick();
  }

  stopMusic() {
    if (!this.musicNodes) return;
    clearTimeout(this.musicNodes.timer);
    for (const o of this.musicNodes.stops) { try { o.stop(); } catch { /* already stopped */ } }
    this.musicNodes.bus.disconnect();
    this.musicNodes = null;
  }
}
