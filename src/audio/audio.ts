/**
 * Procedural audio: a cozy chiptune loop plus synthesized SFX and Lincoln's bark,
 * all generated with the Web Audio API so the game needs no audio files.
 *
 * Browsers block audio until a user gesture, so call `unlock()` from a tap/click
 * (the splash screen does this).
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private musicOn = false;
  private muted = false;

  private static readonly BPM = 96;
  private static readonly STEPS = 16;

  // A gentle C-major pentatonic loop (MIDI note numbers, null = rest).
  private static readonly MELODY: Array<number | null> = [
    72, 76, 79, 76, 69, 72, 76, 74, 67, 71, 74, 71, 72, 76, 79, null,
  ];
  private static readonly BASS: Array<number | null> = [
    48, null, 48, null, 45, null, 45, null, 43, null, 43, null, 48, null, 48, null,
  ];

  get isReady(): boolean {
    return this.ctx !== null;
  }

  /** Create/resume the audio context. Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.5;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.noiseBuffer = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ── Music ───────────────────────────────────────────────────────────────

  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduler(), 25);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduler(): void {
    if (!this.ctx || !this.musicOn) return;
    const stepDur = 60 / AudioManager.BPM / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      const i = this.step % AudioManager.STEPS;
      const melody = AudioManager.MELODY[i];
      const bass = AudioManager.BASS[i];
      if (melody !== null && melody !== undefined) {
        this.blip(this.midiToFreq(melody), this.nextNoteTime, stepDur * 1.6, 'triangle', 0.14, this.musicBus);
      }
      if (bass !== null && bass !== undefined) {
        this.blip(this.midiToFreq(bass), this.nextNoteTime, stepDur * 1.8, 'sine', 0.22, this.musicBus);
      }
      this.nextNoteTime += stepDur;
      this.step += 1;
    }
  }

  // ── SFX ─────────────────────────────────────────────────────────────────

  click(): void {
    this.tone(660, 0.06, 'square', 0.12, 1200);
  }

  snap(): void {
    this.tone(320, 0.07, 'square', 0.16, 180);
  }

  equip(): void {
    this.tone(520, 0.08, 'triangle', 0.16, 640);
    this.tone(780, 0.1, 'triangle', 0.14, 900, 0.08);
  }

  coin(): void {
    this.tone(1180, 0.06, 'square', 0.13, 1180);
    this.tone(1580, 0.1, 'square', 0.12, 1580, 0.07);
  }

  happy(): void {
    const now = 0;
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.16, f, now + i * 0.08));
  }

  sleepZ(): void {
    [659, 523, 440].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.16, f, i * 0.12));
  }

  splash(): void {
    this.noise(0.18, 0.18, 1500, 'highpass');
  }

  /** A rolling thunderclap: deep boom + low rumble + a sharp initial crack. */
  thunder(): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(82, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 1.8);

    this.noise(1.7, 0.4, 320, 'lowpass');
    this.noise(0.12, 0.3, 2200, 'highpass');
  }

  pop(): void {
    this.noise(0.25, 0.25, 900, 'lowpass');
    this.tone(180, 0.2, 'sine', 0.25, 55);
  }

  /** Lincoln's "arf arf!" — two short, band-passed barks. */
  bark(): void {
    const t = this.ctx ? this.ctx.currentTime : 0;
    this.oneBark(t);
    this.oneBark(t + 0.16);
  }

  /** Lincoln's sad whimper when grabbed too hard — two descending cries. */
  whine(): void {
    this.tone(620, 0.22, 'sine', 0.2, 330);
    this.tone(520, 0.3, 'sine', 0.2, 270, 0.22);
  }

  private oneBark(time: number): void {
    if (!this.ctx) return;
    // Voiced part: a quick pitch drop.
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, time);
    osc.frequency.exponentialRampToValueAtTime(240, time + 0.1);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.3, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 1.2;
    osc.connect(g).connect(band).connect(this.sfxBus!);
    osc.start(time);
    osc.stop(time + 0.16);

    // Breath/noise part gives it a "ruff" texture.
    this.noise(0.1, 0.22, 1200, 'bandpass', time);
  }

  // ── Primitives ──────────────────────────────────────────────────────────

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    endFreq?: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private blip(
    freq: number,
    time: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    dest: AudioNode | null,
  ): void {
    if (!this.ctx || !dest) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private noise(dur: number, gain: number, cutoff: number, type: BiquadFilterType, delay = 0): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

export const audio = new AudioManager();
