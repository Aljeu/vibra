import { SpectrumProcessor, createAudioFrame } from './audio/spectrum';
import type { TrackAnalysis } from './audio/track-analysis';
export type { AudioBands, AudioFrame } from './audio/spectrum';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private audio: HTMLAudioElement | null = null;
  private processor: SpectrumProcessor | null = null;
  private analysis: TrackAnalysis | null = null;
  private idle = createAudioFrame();
  private routedSnareId = 0;
  private routedSnareAt = -100;
  private routedSnareStrength = 0;
  private routedSnareConfidence = 0;
  private routedSnarePrepared = false;
  private lastPreparedSnareId = 0;
  private lastLiveSnareId = 0;
  private lastAudioTime = 0;

  private clearSnareRoute() {
    this.routedSnareAt = -100;
    this.routedSnareStrength = 0;
    this.routedSnareConfidence = 0;
    this.routedSnarePrepared = false;
    this.lastPreparedSnareId = 0;
    this.lastLiveSnareId = 0;
    this.lastAudioTime = 0;
  }

  private routeSnare(at: number, strength: number, confidence: number, prepared: boolean) {
    if (at - this.routedSnareAt < 0.14) return;
    this.routedSnareId += 1;
    this.routedSnareAt = at;
    this.routedSnareStrength = clamp(strength);
    this.routedSnareConfidence = clamp(confidence);
    this.routedSnarePrepared = prepared;
  }

  connect(audio: HTMLAudioElement) {
    if (this.context) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -12;
    analyser.smoothingTimeConstant = 0.08;
    const gain = context.createGain();
    const source = context.createMediaElementSource(audio);
    source.connect(analyser).connect(gain).connect(context.destination);
    this.context = context; this.analyser = analyser; this.gain = gain;
    this.source = source; this.audio = audio;
    this.processor = new SpectrumProcessor(context.sampleRate, analyser.fftSize);
  }
  async resume() { if (this.context?.state === 'suspended') await this.context.resume(); }
  setVolume(volume: number) {
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime, 0.025);
  }
  setTrackAnalysis(analysis: TrackAnalysis | null) {
    this.analysis = analysis;
    this.clearSnareRoute();
  }
  /** Called once per visual frame. The frame and its typed buffers are reused. */
  sample(delta = 1 / 60) {
    if (!this.analyser || !this.processor) return this.idle;
    const active = Boolean(this.audio && !this.audio.paused && !this.audio.ended && this.context?.state === 'running');
    const frame = this.processor.frame;
    if (active) {
      this.analyser.getByteFrequencyData(frame.fft as Uint8Array<ArrayBuffer>);
      this.analyser.getFloatTimeDomainData(frame.waveform as Float32Array<ArrayBuffer>);
    } else {
      frame.fft.fill(0); frame.waveform.fill(0);
    }
    const result = this.processor.update(frame.fft, delta, active);
    const liveSnareId = result.snareId;
    const liveSnareAge = result.snareAge;
    const liveSnareStrength = result.snareStrength;
    const liveSnareConfidence = result.snareConfidence;
    if (active && this.analysis && this.analysis.bpm > 0 && this.audio) {
      const now = this.audio.currentTime;
      if (now + 0.05 < this.lastAudioTime) this.clearSnareRoute();
      this.lastAudioTime = now;
      const mapped = this.analysis.sample(now);
      result.beat = mapped.pulse;
      result.beatId = mapped.beatId;
      result.beatStrength = mapped.strength;
      result.beatConfidence = mapped.confidence;
      result.beatPhase = mapped.phase;
      result.beatObserved = mapped.beatObserved;
      result.downbeat = mapped.downbeat;
      result.trackEnergy = mapped.energy;

      // Event-level timing and repetition evidence decide whether a prepared
      // snare survives. Global confidence shapes its certainty but never erases
      // an otherwise strong, beat-locked event.
      const preparedConfidence = clamp(mapped.snareConfidence * (0.8 + this.analysis.percussionConfidence * 0.2));
      const preparedEvent = mapped.snareId > 0
        && mapped.snareAge <= 0.18
        && preparedConfidence >= 0.5
        && mapped.snareId !== this.lastPreparedSnareId;
      if (preparedEvent) {
        this.lastPreparedSnareId = mapped.snareId;
        this.routeSnare(now, mapped.snareStrength, preparedConfidence, true);
      } else {
        // Live detection is only allowed to fill uncertain gaps. It must be a
        // fresh, strong transient close to the learned beat and cannot double
        // an event the prepared map has just supplied.
        const beatDistance = Math.min(mapped.phase, 1 - mapped.phase);
        const needsFallback = this.analysis.snareCount < 3 || this.analysis.percussionConfidence < 0.72;
        const nearPreparedEvent = mapped.snareId > 0 && mapped.snareAge < 0.24;
        const freshLiveEvent = liveSnareId !== this.lastLiveSnareId && liveSnareAge <= 0.12;
        if (freshLiveEvent) this.lastLiveSnareId = liveSnareId;
        if (needsFallback && mapped.beatId > 0 && freshLiveEvent && !nearPreparedEvent && beatDistance <= 0.14 && liveSnareStrength >= 0.54) {
          const timingConfidence = clamp(1 - beatDistance / 0.14);
          const confidence = clamp(liveSnareConfidence * 0.68 + timingConfidence * 0.32);
          if (confidence >= 0.58) this.routeSnare(now, 0.5 + liveSnareStrength * 0.5, confidence, false);
        }
      }

      const routedAge = Math.max(0, now - this.routedSnareAt);
      const routedActive = this.routedSnareId > 0 && routedAge < 0.44;
      result.snare = routedActive ? this.routedSnareStrength * Math.exp(-routedAge / 0.13) : 0;
      result.snareId = routedActive ? this.routedSnareId : 0;
      result.snareStrength = routedActive ? this.routedSnareStrength : 0;
      result.snareConfidence = routedActive ? this.routedSnareConfidence : 0;
      result.snarePrepared = routedActive && this.routedSnarePrepared;
      result.snareAge = routedActive ? routedAge : 100;
    } else {
      result.downbeat = false;
      result.trackEnergy = result.energy;
    }
    return result;
  }
  reset() { this.processor?.reset(); this.clearSnareRoute(); }
  dispose() {
    this.audio?.pause();
    this.source?.disconnect(); this.analyser?.disconnect(); this.gain?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null; this.source = null; this.analyser = null;
    this.gain = null; this.audio = null; this.processor = null; this.analysis = null;
  }
}
