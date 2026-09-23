import { BeatTracker } from './beat-tracker.ts';

export type AudioBands = { bass: number; mids: number; treble: number; energy: number; fft: Uint8Array };
export type AudioFrame = AudioBands & {
  subBass: number; kick: number; snare: number; highHit: number;
  kickId: number; kickAge: number; kickStrength: number;
  snareId: number; snareAge: number; snareStrength: number;
  snareConfidence: number; snarePrepared: boolean; waveform: Float32Array;
  beat: number; beatId: number; beatStrength: number; beatConfidence: number; beatPhase: number;
  beatObserved: boolean; downbeat: boolean; trackEnergy: number;
};

export function createAudioFrame(fftSize = 2048): AudioFrame {
  return {
    bass: 0, subBass: 0, mids: 0, treble: 0, energy: 0,
    kick: 0, snare: 0, highHit: 0, kickId: 0, kickAge: 100, kickStrength: 0,
    snareId: 0, snareAge: 100, snareStrength: 0, snareConfidence: 0, snarePrepared: false,
    beat: 0, beatId: 0, beatStrength: 0, beatConfidence: 0, beatPhase: 0, beatObserved: false, downbeat: false, trackEnergy: 0,
    fft: new Uint8Array(fftSize / 2), waveform: new Float32Array(fftSize),
  };
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const follow = (current: number, target: number, dt: number, attack: number, release: number) =>
  current + (target - current) * (1 - Math.exp(-dt / (target > current ? attack : release)));
type Band = { from: number; to: number; baseline: number; lastHit: number; flux: number; level: number };

/** Frequency-aware analysis. All buffers and the returned frame are reused. */
export class SpectrumProcessor {
  readonly frame: AudioFrame;
  private readonly previous: Float32Array;
  private readonly ranges: Band[];
  private readonly beats = new BeatTracker();
  private time = 0;

  constructor(sampleRate = 48000, fftSize = 2048) {
    this.frame = createAudioFrame(fftSize);
    this.previous = new Float32Array(fftSize / 2);
    const binHz = sampleRate / fftSize;
    this.ranges = [[25, 90], [35, 220], [220, 2400], [2400, 12000], [1800, 6000], [250, 1600], [35, 150]].map(([low, high]) => ({
      from: Math.max(1, Math.floor(low / binHz)), to: Math.min(fftSize / 2, Math.ceil(high / binHz)),
      baseline: 0, lastHit: -100, flux: 0, level: 0,
    }));
  }

  update(spectrum: Uint8Array, dt: number, active = true): AudioFrame {
    dt = Math.max(1 / 240, Math.min(0.1, dt));
    this.time += dt;
    const frame = this.frame;
    for (const band of this.ranges) {
      let sum = 0, peak = 0, flux = 0;
      for (let i = band.from; i < band.to; i += 1) {
        const value = active ? clamp(((spectrum[i] ?? 0) / 255 - 0.16) / 0.84) : 0;
        sum += value * value;
        peak = Math.max(peak, value);
        flux += Math.max(0, value - this.previous[i]);
      }
      const count = Math.max(1, band.to - band.from);
      band.level = clamp(Math.sqrt(sum / count) * 0.65 + peak * 0.35);
      band.flux = flux / count;
    }
    const bass = this.ranges[1], mids = this.ranges[2], highs = this.ranges[3];
    const snareBand = this.ranges[4], voiceBand = this.ranges[5], kickBand = this.ranges[6];
    // Impacts use unsmoothed spectral change, independently of the slower body envelopes.
    const detect = (band: Band, interval: number, noveltyFloor = 0.045, fluxFloor = 0.012) => {
      const novelty = band.level - band.baseline * 1.08 - 0.025;
      if (band.level > 0.1 && (novelty > noveltyFloor || band.flux > fluxFloor * 2.5) && band.flux > fluxFloor && this.time - band.lastHit > interval) {
        band.lastHit = this.time;
        return Math.sqrt(clamp(Math.max(0, novelty) * 2.1 + band.flux * 3.2));
      }
      return 0;
    };
    const kick = detect(kickBand, 0.11, 0.045, 0.014);
    const vocalLike = voiceBand.level > snareBand.level * 0.72 && voiceBand.flux > snareBand.flux * 0.62;
    const snare = vocalLike ? 0 : detect(snareBand, 0.15, 0.06, 0.02);
    const highHit = detect(highs, 0.055);
    frame.kick = Math.max(kick, frame.kick * Math.exp(-dt / 0.22));
    frame.snare = Math.max(snare, frame.snare * Math.exp(-dt / 0.14));
    frame.highHit = Math.max(highHit, frame.highHit * Math.exp(-dt / 0.09));
    if (kick > 0) { frame.kickId += 1; frame.kickStrength = kick; }
    if (snare > 0) {
      frame.snareId += 1;
      frame.snareStrength = snare;
      frame.snareConfidence = clamp(0.48 + snare * 0.4);
      frame.snarePrepared = false;
    }
    frame.kickAge = this.time - kickBand.lastHit;
    frame.snareAge = this.time - snareBand.lastHit;
    const beat = this.beats.update(this.time, kick, dt, active);
    frame.beat = beat.pulse;
    frame.beatId = beat.pulseId;
    frame.beatStrength = beat.strength;
    frame.beatConfidence = beat.confidence;
    frame.beatPhase = beat.phase;
    frame.beatObserved = beat.observed;
    frame.subBass = follow(frame.subBass, this.ranges[0].level, dt, 0.035, 0.28);
    frame.bass = follow(frame.bass, bass.level, dt, 0.016, 0.16);
    frame.mids = follow(frame.mids, mids.level, dt, 0.024, 0.16);
    frame.treble = follow(frame.treble, highs.level, dt, 0.012, 0.1);
    frame.energy = follow(frame.energy, bass.level * 0.45 + mids.level * 0.35 + highs.level * 0.2, dt, 0.028, 0.22);
    for (const band of this.ranges) band.baseline = follow(band.baseline, band.level, dt, 0.24, 0.3);
    for (let i = 0; i < this.previous.length; i += 1) {
      this.previous[i] = active ? clamp(((spectrum[i] ?? 0) / 255 - 0.16) / 0.84) : 0;
    }
    if (spectrum !== frame.fft) frame.fft.set(spectrum.subarray(0, frame.fft.length));
    return frame;
  }

  reset() {
    this.previous.fill(0); this.frame.fft.fill(0); this.frame.waveform.fill(0);
    this.beats.reset();
    for (const band of this.ranges) {
      band.baseline = 0; band.lastHit = -100; band.level = 0; band.flux = 0;
    }
    Object.assign(this.frame, {
      bass: 0, subBass: 0, mids: 0, treble: 0, energy: 0,
      kick: 0, snare: 0, highHit: 0, kickId: 0, kickAge: 100, kickStrength: 0,
      snareId: 0, snareAge: 100, snareStrength: 0, snareConfidence: 0, snarePrepared: false,
      beat: 0, beatId: 0, beatStrength: 0, beatConfidence: 0, beatPhase: 0, beatObserved: false, downbeat: false, trackEnergy: 0,
    });
    this.time = 0;
  }
}
