const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const GATE_NOTES = { X: [220, 440], H: [329.63, 493.88, 659.25], Z: [246.94, 369.99], S: [293.66, 440], 'S†': [440, 293.66], T: [369.99, 554.37] };

/** Compact procedural stadium soundtrack. No network assets or autoplay attempts. */
export class MatchAudio {
  constructor() {
    this.enabled = true;
    this.intensity = 0;
    this.context = null;
    this._master = null;
    this._crowd = null;
    this._noiseBuffer = null;
    this._lastPressure = -Infinity;
    this._lastGate = -Infinity;
    this._voices = new Set();
    this._destroyed = false;
    this._playing = false;
  }

  async unlock() {
    if (this._destroyed) return false;
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.context = new AudioContext();
        this._master = this.context.createGain();
        this._master.gain.value = this.enabled ? 0.6 : 0;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -13;
        limiter.knee.value = 14;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.004;
        limiter.release.value = 0.18;
        this._master.connect(limiter);
        limiter.connect(this.context.destination);
        this._noiseBuffer = this.context.createBuffer(2, this.context.sampleRate * 3, this.context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const data = this._noiseBuffer.getChannelData(channel);
          let previous = 0;
          for (let i = 0; i < data.length; i++) {
            previous = (previous + Math.random() * 0.18 - 0.09) / 1.04;
            data[i] = previous * 3;
          }
        }
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this._playing = true;
      if (this.enabled) this._startCrowd();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.context) return;
    const now = this.context.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setTargetAtTime(this.enabled ? 0.6 : 0, now, 0.04);
    if (this.enabled && this._playing) this._startCrowd();
    else this._stopCrowd();
  }

  setIntensity(intensity) {
    const next = clamp(Number(intensity) || 0);
    if (Math.abs(next - this.intensity) < 0.015) return;
    this.intensity = next;
    if (!this._crowd) return;
    const now = this.context.currentTime;
    this._crowd.gain.gain.setTargetAtTime(0.055 + this.intensity * 0.1, now, 0.5);
    this._crowd.filter.frequency.setTargetAtTime(560 + this.intensity * 450, now, 0.45);
    this._crowd.wobbleGain.gain.setTargetAtTime(0.014 + this.intensity * 0.018, now, 0.5);
  }

  _startCrowd() {
    if (this._crowd || !this.context || !this.enabled || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 560 + this.intensity * 450;
    filter.Q.value = 0.65;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.055 + this.intensity * 0.1, this.context.currentTime, 0.65);
    const wobble = this.context.createOscillator();
    wobble.frequency.value = 0.37;
    const wobbleGain = this.context.createGain();
    wobbleGain.gain.value = 0.014 + this.intensity * 0.018;
    wobble.connect(wobbleGain);
    wobbleGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._master);
    source.start();
    wobble.start();
    this._crowd = { source, filter, gain, wobble, wobbleGain };
  }

  _stopCrowd() {
    if (!this._crowd) return;
    const crowd = this._crowd;
    this._crowd = null;
    const now = this.context.currentTime;
    crowd.gain.gain.cancelScheduledValues(now);
    crowd.gain.gain.setTargetAtTime(0, now, 0.025);
    try { crowd.wobble.stop(now + 0.12); crowd.source.stop(now + 0.12); } catch { /* Already stopped. */ }
    crowd.source.onended = () => {
      crowd.source.disconnect(); crowd.filter.disconnect(); crowd.gain.disconnect();
      crowd.wobble.disconnect(); crowd.wobbleGain.disconnect();
    };
  }

  _track(source, nodes, duration, time) {
    const voice = { source, nodes };
    this._voices.add(voice);
    source.onended = () => {
      this._voices.delete(voice);
      for (const node of nodes) node.disconnect();
    };
    source.start(time);
    source.stop(time + duration + 0.015);
  }

  _tone(frequency, endFrequency, duration, volume, delay = 0, type = 'sine', attack = 0.006) {
    const time = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), time + duration);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + Math.min(attack, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(this._master);
    this._track(oscillator, [oscillator, envelope], duration, time);
  }

  _noise(duration, volume, frequency, delay = 0, filterType = 'bandpass', attack = 0.004) {
    const time = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this._noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = filterType === 'bandpass' ? 0.75 : 0.5;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + Math.min(attack, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this._master);
    this._track(source, [source, filter, envelope], duration, time);
  }

  play(type, event = {}) {
    if (this._destroyed || !this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (this._voices.size > 42) return;
    switch (type) {
      case 'touch':
      case 'kick': {
        const power = clamp(typeof event === 'number' ? event : event.power ?? (type === 'touch' ? 0.12 : 0.5));
        const variation = 0.96 + Math.random() * 0.08;
        this._tone(150 * variation, 42, 0.1 + power * 0.04, 0.12 + power * 0.08);
        this._noise(0.045, 0.11 + power * 0.06, 1700);
        break;
      }
      case 'laneGate':
      case 'gate': {
        if (now - this._lastGate < 0.07) return;
        this._lastGate = now;
        const gate = typeof event === 'string' ? event : event.gate || 'H';
        const notes = GATE_NOTES[gate] || GATE_NOTES.H;
        notes.forEach((note, index) => this._tone(note, note * 1.008, 0.2, 0.043, index * 0.025, 'triangle'));
        this._tone(notes[0] * 2, notes[0] * 2.03, 0.08, 0.025);
        break;
      }
      case 'split':
        this._noise(0.34, 0.065, 2000, 0, 'bandpass', 0.035);
        this._tone(392, 783.99, 0.3, 0.046, 0, 'sine', 0.025);
        this._tone(523.25, 261.63, 0.3, 0.046, 0.025, 'sine', 0.025);
        break;
      case 'recombine': {
        const alternate = event.port === 1 || event.alternate === true;
        const notes = alternate ? [440, 349.23, 523.25] : [523.25, 783.99, 1046.5];
        notes.forEach((note, index) => this._tone(note, note, 0.28, 0.055, index * 0.035, 'triangle', 0.012));
        this._noise(0.11, 0.042, 2700, 0, 'highpass', 0.012);
        break;
      }
      case 'pathCollapse':
        this._noise(0.065, 0.08, 2800, 0, 'highpass');
        this._tone(660, 220, 0.17, 0.06, 0, 'triangle');
        this._tone(110, 65, 0.095, 0.07, 0.04);
        break;
      case 'rebound':
        this._tone(190, 65, 0.11, 0.15);
        this._noise(0.055, 0.11, 1700);
        this._tone(369.99, 246.94, 0.19, 0.035, 0.02, 'triangle');
        break;
      case 'tackle':
        this._tone(95, 35, 0.16, 0.23);
        this._noise(0.13, 0.21, 850);
        this._tone(400, 180, 0.08, 0.035, 0.025, 'triangle');
        break;
      case 'reset':
        [392, 523.25, 783.99].forEach((note, index) => this._tone(note, note, 0.3, 0.04, index * 0.065, 'triangle'));
        this._noise(0.2, 0.025, 1900, 0, 'highpass', 0.035);
        break;
      case 'pressure':
        if (now - this._lastPressure < 0.2) return;
        this._lastPressure = now;
        this._noise(0.04, 0.034, 3600, 0, 'highpass');
        this._noise(0.025, 0.025, 1900, 0.04, 'highpass');
        break;
      case 'save':
        this._tone(110, 58, 0.14, 0.19);
        this._noise(0.16, 0.18, 700);
        this._noise(0.5, 0.075, 950, 0.04, 'bandpass', 0.1);
        break;
      case 'measure':
        this._tone(320, 920, 0.35, 0.055, 0, 'triangle', 0.02);
        this._tone(325, 928, 0.35, 0.04, 0, 'sine', 0.02);
        this._noise(0.26, 0.025, 2200, 0, 'bandpass', 0.07);
        break;
      case 'goal':
        this._noise(2.1, 0.55, 1000, 0, 'bandpass', 0.18);
        this._noise(1.3, 0.2, 2300, 0.12, 'bandpass', 0.2);
        this._tone(72, 40, 0.3, 0.24);
        [392, 523.25, 659.25, 783.99].forEach((note, index) => this._tone(note, note, 0.7, 0.065, 0.04 + index * 0.09, 'triangle', 0.025));
        break;
      case 'miss':
        this._noise(0.9, 0.18, 380, 0, 'bandpass', 0.08);
        this._tone(246.94, 164.81, 0.45, 0.055, 0, 'triangle', 0.018);
        this._tone(196, 130.81, 0.55, 0.045, 0.07, 'triangle', 0.018);
        this._noise(0.15, 0.05, 3500, 0, 'highpass');
        break;
      case 'reading':
        this._tone(523.25, 783.99, 0.2, 0.052, 0, 'sine', 0.02);
        this._tone(783.99, 523.25, 0.2, 0.042, 0.1, 'sine', 0.02);
        break;
      case 'whistle':
        this._whistle(0);
        break;
      case 'halftime':
        this._whistle(0); this._whistle(0.23);
        break;
      case 'fulltime':
        this._whistle(0); this._whistle(0.23); this._whistle(0.5, 0.55);
        break;
      default:
        break;
    }
  }

  _whistle(delay, duration = 0.18) {
    this._tone(2450, 2350, duration, 0.085, delay, 'sine', 0.025);
    this._tone(2810, 2780, duration, 0.047, delay, 'sine', 0.02);
    this._noise(duration * 0.75, 0.025, 4000, delay, 'highpass', 0.01);
  }

  stop() {
    this._playing = false;
    this._stopCrowd();
    for (const voice of this._voices) {
      try { voice.source.stop(); } catch { /* Already ended. */ }
    }
    this._voices.clear();
    this._lastPressure = -Infinity;
    this._lastGate = -Infinity;
  }

  destroy() {
    this.stop();
    this._destroyed = true;
    if (this.context) {
      const closing = this.context.close();
      if (closing?.catch) closing.catch(() => {});
    }
  }
}
