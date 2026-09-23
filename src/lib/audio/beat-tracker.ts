export type BeatState = {
  pulse: number;
  pulseId: number;
  strength: number;
  confidence: number;
  phase: number;
  observed: boolean;
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

/**
 * Turns low-frequency onsets into a musical pulse. It responds to the first
 * plausible kick immediately, then uses repeated hits to estimate spacing and
 * lightly fill an occasional missing beat.
 */
export class BeatTracker {
  private interval = 0.5;
  private confidence = 0;
  private lastOnsetAt = -Infinity;
  private lastBeatAt = -Infinity;
  private pulse = 0;
  private pulseId = 0;
  private strength = 0;
  private observed = false;

  update(time: number, onset: number, dt: number, active: boolean): BeatState {
    if (!active) {
      this.clearRhythm();
      return this.snapshot(0);
    }

    this.pulse *= Math.exp(-dt / 0.34);
    if (onset > 0) this.acceptOnset(time, onset);

    const sinceBeat = time - this.lastBeatAt;
    const sinceOnset = time - this.lastOnsetAt;
    if (this.confidence >= 0.44 && sinceBeat >= this.interval * 1.08 && sinceOnset >= this.interval * 0.74) {
      this.emit(time, 0.3 + this.confidence * 0.26, false);
    }

    const phase = Number.isFinite(this.lastBeatAt) ? clamp((time - this.lastBeatAt) / this.interval) : 0;
    return this.snapshot(phase);
  }

  reset() {
    this.clearRhythm();
    this.pulseId = 0;
  }

  private acceptOnset(time: number, onset: number) {
    const gap = time - this.lastOnsetAt;
    // Very close low-frequency transients stay as sonic detail; they do not
    // become another body-sized beat.
    if (gap < 0.235) return;

    if (Number.isFinite(this.lastOnsetAt)) {
      if (gap >= 0.28 && gap <= 1.22) {
        const deviation = Math.abs(gap - this.interval) / this.interval;
        const matchedPulse = deviation < 0.34;
        this.interval += (gap - this.interval) * (matchedPulse ? 0.19 : 0.07);
        this.interval = clamp(this.interval, 0.3, 1.0);
        this.confidence = clamp(this.confidence + (matchedPulse ? 0.24 : -0.06));
      } else {
        this.confidence *= 0.78;
      }
    }

    this.lastOnsetAt = time;
    // A clear bass onset always gets a gesture. The confidence only decides
    // how much additional weight it receives, never whether it is visible.
    this.emit(time, clamp(0.42 + onset * 0.43 + this.confidence * 0.15, 0.38, 1), true);
  }

  private emit(time: number, strength: number, observed: boolean) {
    this.lastBeatAt = time;
    this.strength = strength;
    this.observed = observed;
    this.pulse = Math.max(this.pulse, strength);
    this.pulseId += 1;
  }

  private clearRhythm() {
    this.interval = 0.5;
    this.confidence = 0;
    this.lastOnsetAt = -Infinity;
    this.lastBeatAt = -Infinity;
    this.pulse = 0;
    this.strength = 0;
    this.observed = false;
  }

  private snapshot(phase: number): BeatState {
    return { pulse: this.pulse, pulseId: this.pulseId, strength: this.strength, confidence: this.confidence, phase, observed: this.observed };
  }
}
