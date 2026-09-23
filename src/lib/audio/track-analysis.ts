export type AnalysisProgress = (progress: number) => void;

export type BeatMapFrame = {
  pulse: number;
  beatId: number;
  strength: number;
  confidence: number;
  phase: number;
  beatObserved: boolean;
  downbeat: boolean;
  energy: number;
  snare: number;
  snareId: number;
  snareStrength: number;
  snareConfidence: number;
  snareAge: number;
};

type AnalysisOptions = { onProgress?: AnalysisProgress; signal?: AbortSignal };
type Onset = { time: number; strength: number; transient: number };
type SnareCandidate = Onset & { timing: number };

const HOP = 512;
const FFT_SIZE = 1024;
const FFT_BINS = FFT_SIZE / 2;
const MIN_BPM = 55;
const MAX_BPM = 190;
const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Track analysis was replaced.', 'AbortError');
}

function upperBound(values: Float32Array, target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function average(values: Float32Array) {
  let sum = 0;
  for (const value of values) sum += value;
  return values.length ? sum / values.length : 0;
}

function deviation(values: Float32Array, mean: number) {
  let sum = 0;
  for (const value of values) sum += (value - mean) ** 2;
  return values.length ? Math.sqrt(sum / values.length) : 0;
}

function percentile(values: number[], amount: number) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const position = clamp(amount) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const blend = position - lower;
  return (sorted[lower] ?? 0) * (1 - blend) + (sorted[upper] ?? 0) * blend;
}

function fft(real: Float32Array, imaginary: Float32Array) {
  for (let index = 1, reverse = 0; index < FFT_SIZE; index += 1) {
    let bit = FFT_SIZE >> 1;
    for (; reverse & bit; bit >>= 1) reverse ^= bit;
    reverse ^= bit;
    if (index < reverse) {
      const realValue = real[index]; real[index] = real[reverse]; real[reverse] = realValue;
      const imaginaryValue = imaginary[index]; imaginary[index] = imaginary[reverse]; imaginary[reverse] = imaginaryValue;
    }
  }
  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const half = length >> 1;
    const angle = -2 * Math.PI / length;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    for (let start = 0; start < FFT_SIZE; start += length) {
      let currentCosine = 1;
      let currentSine = 0;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const rotatedReal = real[odd] * currentCosine - imaginary[odd] * currentSine;
        const rotatedImaginary = real[odd] * currentSine + imaginary[odd] * currentCosine;
        real[odd] = real[even] - rotatedReal;
        imaginary[odd] = imaginary[even] - rotatedImaginary;
        real[even] += rotatedReal;
        imaginary[even] += rotatedImaginary;
        const nextCosine = currentCosine * cosine - currentSine * sine;
        currentSine = currentSine * cosine + currentCosine * sine;
        currentCosine = nextCosine;
      }
    }
  }
}

function findOnsets(
  novelty: Float32Array,
  frameSeconds: number,
  minGap = 0.235,
  thresholdLift = 0.72,
  transientGate = false,
  minimumTransient = 0.35,
): Onset[] {
  const mean = average(novelty);
  const threshold = mean + deviation(novelty, mean) * thresholdLift;
  const onsets: Onset[] = [];
  for (let index = 1; index < novelty.length - 1; index += 1) {
    const value = novelty[index];
    if (value <= threshold || value < novelty[index - 1] || value < novelty[index + 1]) continue;
    const lookahead = Math.max(2, Math.round(0.12 / frameSeconds));
    let tail = 0;
    let tailCount = 0;
    for (let offset = 1; offset <= lookahead && index + offset < novelty.length; offset += 1) {
      tail += novelty[index + offset];
      tailCount += 1;
    }
    const tailAverage = tail / Math.max(tailCount, 1);
    const attack = clamp((value - novelty[index - 1]) / Math.max(value, 0.00001));
    const decay = clamp((value - tailAverage) / Math.max(value, 0.00001));
    const transient = clamp(attack * 0.55 + decay * 0.45);
    if (transientGate && transient < minimumTransient) continue;
    const time = index * frameSeconds;
    const strength = clamp((0.42 + (value - threshold) / Math.max(threshold * 1.6, 0.00001)) * (0.78 + transient * 0.22));
    const previous = onsets[onsets.length - 1];
    if (previous && time - previous.time < minGap) {
      if (strength > previous.strength) onsets[onsets.length - 1] = { time, strength, transient };
      continue;
    }
    onsets.push({ time, strength, transient });
  }
  return onsets;
}

function estimateTempo(novelty: Float32Array, frameSeconds: number) {
  let bestBpm = 0;
  let bestScore = 0;
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 1) {
    const lag = Math.round(60 / bpm / frameSeconds);
    if (lag < 2 || lag >= novelty.length) continue;
    let score = 0;
    let count = 0;
    for (let index = lag; index < novelty.length; index += 2) {
      score += novelty[index] * novelty[index - lag];
      count += 1;
    }
    score /= Math.max(count, 1);
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  return { bpm: bestBpm, score: bestScore };
}

function findPhase(onsets: Onset[], period: number) {
  const steps = 48;
  const tolerance = period * 0.14;
  let phase = 0;
  let bestScore = -Infinity;
  for (let step = 0; step < steps; step += 1) {
    const candidate = period * step / steps;
    let score = 0;
    for (const onset of onsets) {
      const offset = ((onset.time - candidate) % period + period) % period;
      const distance = Math.min(offset, period - offset);
      if (distance < tolerance) score += onset.strength * (1 - distance / tolerance);
    }
    if (score > bestScore) { bestScore = score; phase = candidate; }
  }
  return phase;
}

function inferMeter(strengths: Float32Array, confidence: number) {
  if (confidence < 0.56 || strengths.length < 12) return { meter: 0, offset: 0 };
  const global = average(strengths);
  let bestMeter = 0;
  let bestOffset = 0;
  let bestLift = 0;
  for (const meter of [4, 3]) {
    for (let offset = 0; offset < meter; offset += 1) {
      let sum = 0;
      let count = 0;
      for (let index = offset; index < strengths.length; index += meter) { sum += strengths[index]; count += 1; }
      const lift = sum / Math.max(count, 1) / Math.max(global, 0.001) - 1;
      if (lift > bestLift) { bestLift = lift; bestMeter = meter; bestOffset = offset; }
    }
  }
  return bestLift > 0.17 ? { meter: bestMeter, offset: bestOffset } : { meter: 0, offset: 0 };
}

/** A compact, local timing map created before playback. */
export class TrackAnalysis {
  private readonly sampleFrame: BeatMapFrame = {
    pulse: 0, beatId: 0, strength: 0, confidence: 0, phase: 0, beatObserved: false, downbeat: false, energy: 0,
    snare: 0, snareId: 0, snareStrength: 0, snareConfidence: 0, snareAge: 100,
  };
  readonly duration: number;
  readonly bpm: number;
  readonly confidence: number;
  readonly percussionConfidence: number;
  readonly meter: number;
  private readonly beatTimes: Float32Array;
  private readonly beatStrengths: Float32Array;
  private readonly beatObserved: Uint8Array;
  private readonly downbeats: Uint8Array;
  private readonly energy: Float32Array;
  private readonly frameSeconds: number;
  private readonly snareTimes: Float32Array;
  private readonly snareStrengths: Float32Array;
  private readonly snareConfidences: Float32Array;
  readonly snareCount: number;

  constructor(
    duration: number,
    bpm: number,
    confidence: number,
    meter: number,
    beatTimes: Float32Array,
    beatStrengths: Float32Array,
    downbeats: Uint8Array,
    energy: Float32Array,
    frameSeconds: number,
    beatObserved = new Uint8Array(),
    snareTimes = new Float32Array(),
    snareStrengths = new Float32Array(),
    percussionConfidence = 0,
    snareConfidences = new Float32Array(),
  ) {
    this.duration = duration;
    this.bpm = bpm;
    this.confidence = confidence;
    this.percussionConfidence = percussionConfidence;
    this.meter = meter;
    this.beatTimes = beatTimes;
    this.beatStrengths = beatStrengths;
    this.beatObserved = beatObserved;
    this.downbeats = downbeats;
    this.energy = energy;
    this.frameSeconds = frameSeconds;
    this.snareTimes = snareTimes;
    this.snareStrengths = snareStrengths;
    this.snareConfidences = snareConfidences;
    this.snareCount = snareTimes.length;
  }

  sample(time: number) {
    const frame = this.sampleFrame;
    const beatIndex = upperBound(this.beatTimes, time) - 1;
    const snareIndex = upperBound(this.snareTimes, time) - 1;
    const energyIndex = clamp(Math.floor(time / this.frameSeconds), 0, Math.max(0, this.energy.length - 1));
    frame.energy = this.energy[energyIndex] ?? 0;
    frame.confidence = this.confidence * 0.28;
    if (snareIndex < 0) {
      frame.snare = 0; frame.snareId = 0; frame.snareStrength = 0; frame.snareConfidence = 0; frame.snareAge = 100;
    } else {
      const age = Math.max(0, time - this.snareTimes[snareIndex]);
      const strength = this.snareStrengths[snareIndex] ?? 0;
      frame.snare = age < 0.42 ? strength * Math.exp(-age / 0.13) : 0;
      frame.snareId = snareIndex + 1;
      frame.snareStrength = strength;
      frame.snareConfidence = this.snareConfidences[snareIndex] ?? this.percussionConfidence;
      frame.snareAge = age;
    }
    if (beatIndex < 0) {
      frame.pulse = 0; frame.beatId = 0; frame.strength = 0; frame.phase = 0; frame.beatObserved = false; frame.downbeat = false;
      return frame;
    }
    const sinceBeat = Math.max(0, time - this.beatTimes[beatIndex]);
    const interval = this.beatTimes[beatIndex + 1] ? this.beatTimes[beatIndex + 1] - this.beatTimes[beatIndex] : 60 / Math.max(this.bpm, 1);
    frame.pulse = this.beatStrengths[beatIndex] * Math.exp(-sinceBeat / 0.34);
    frame.beatId = beatIndex + 1;
    frame.strength = this.beatStrengths[beatIndex];
    frame.phase = clamp(sinceBeat / Math.max(interval, 0.1));
    frame.beatObserved = this.beatObserved.length ? this.beatObserved[beatIndex] === 1 : true;
    // Confirmed beats can drive a full impact. Predicted beats retain phase with
    // a deliberately lower confidence so the renderer can use a quiet rhythmic floor.
    frame.confidence = this.confidence * (frame.beatObserved ? 0.95 : 0.32);
    frame.downbeat = this.downbeats[beatIndex] === 1;
    return frame;
  }
}

export async function analyzeTrack(file: File, { onProgress, signal }: AnalysisOptions = {}) {
  const report = (value: number) => onProgress?.(Math.round(clamp(value) * 100));
  report(2);
  const bytes = await file.arrayBuffer();
  assertNotAborted(signal);
  report(10);
  const context = new OfflineAudioContext(1, 1, 44100);
  const buffer = await context.decodeAudioData(bytes);
  assertNotAborted(signal);
  report(18);

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const frames = Math.ceil(buffer.length / HOP);
  const novelty = new Float32Array(frames);
  const snareNovelty = new Float32Array(frames);
  const energy = new Float32Array(frames);
  const frameSeconds = HOP / buffer.sampleRate;
  const real = new Float32Array(FFT_SIZE);
  const imaginary = new Float32Array(FFT_SIZE);
  const previousMagnitude = new Float32Array(FFT_BINS);
  const window = Float32Array.from({ length: FFT_SIZE }, (_, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (FFT_SIZE - 1)));
  const binHz = buffer.sampleRate / FFT_SIZE;
  let bassBaseline = 0;
  let snareBaseline = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    let fullPower = 0;
    let validSamples = 0;
    for (let windowIndex = 0; windowIndex < FFT_SIZE; windowIndex += 1) {
      const sampleIndex = frame * HOP + windowIndex;
      let sample = 0;
      if (sampleIndex < buffer.length) {
        for (const channel of channels) sample += channel[sampleIndex] ?? 0;
        sample /= channels.length;
        if (windowIndex < HOP) { fullPower += sample * sample; validSamples += 1; }
      }
      real[windowIndex] = sample * window[windowIndex];
      imaginary[windowIndex] = 0;
    }
    fft(real, imaginary);
    let bassLevel = 0;
    let bassFlux = 0;
    let snareLevel = 0;
    let snareFlux = 0;
    let snarePeakFlux = 0;
    let voiceLevel = 0;
    let voiceFlux = 0;
    let bassBins = 0;
    let snareBins = 0;
    let voiceBins = 0;
    for (let bin = 1; bin < FFT_BINS; bin += 1) {
      const magnitude = Math.hypot(real[bin], imaginary[bin]) * 2 / FFT_SIZE;
      const flux = Math.max(0, magnitude - previousMagnitude[bin]);
      previousMagnitude[bin] = magnitude;
      const frequency = bin * binHz;
      if (frequency >= 35 && frequency <= 180) {
        bassLevel += magnitude; bassFlux += flux; bassBins += 1;
      }
      if (frequency >= 1700 && frequency <= 7500) {
        snareLevel += magnitude; snareFlux += flux; snareBins += 1;
        snarePeakFlux = Math.max(snarePeakFlux, flux);
      }
      if (frequency >= 250 && frequency <= 1600) {
        voiceLevel += magnitude; voiceFlux += flux; voiceBins += 1;
      }
    }
    bassLevel /= Math.max(bassBins, 1);
    bassFlux /= Math.max(bassBins, 1);
    snareLevel /= Math.max(snareBins, 1);
    snareFlux /= Math.max(snareBins, 1);
    voiceLevel /= Math.max(voiceBins, 1);
    voiceFlux /= Math.max(voiceBins, 1);
    const fullLevel = Math.sqrt(fullPower / Math.max(validSamples, 1));
    const bassRise = Math.max(0, bassLevel - bassBaseline * 1.045);
    novelty[frame] = bassFlux * 1.4 + bassRise * 0.7;
    const snareRise = Math.max(0, snareLevel - snareBaseline * 1.05);
    const focusedFlux = snareFlux + snarePeakFlux * 0.5;
    const percussiveFocus = clamp((focusedFlux - voiceFlux * 0.22) / Math.max(focusedFlux, 0.00001));
    const voiceMask = clamp((voiceLevel / Math.max(snareLevel, 0.00001) - 0.4) / 0.9);
    snareNovelty[frame] = (snareFlux * 0.95 + snarePeakFlux * 0.5 + snareRise * 0.55) * percussiveFocus * (1 - voiceMask * 0.58);
    energy[frame] = fullLevel;
    bassBaseline += (bassLevel - bassBaseline) * 0.06;
    snareBaseline += (snareLevel - snareBaseline) * 0.07;
    if (frame % 80 === 0) {
      assertNotAborted(signal);
      report(18 + frame / frames * 62);
      await yieldToBrowser();
    }
  }

  const energyMean = average(energy);
  const energyDeviation = deviation(energy, energyMean);
  for (let index = 0; index < energy.length; index += 1) {
    energy[index] = clamp(0.3 + (energy[index] - energyMean) / Math.max(energyDeviation * 3.1, 0.00001));
  }
  report(82);
  const bassOnsets = findOnsets(novelty, frameSeconds, 0.28, 0.92, true, 0.3);
  const timingNovelty = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) timingNovelty[index] = novelty[index] + snareNovelty[index] * 0.65;
  const timingOnsets = findOnsets(timingNovelty, frameSeconds, 0.24, 0.8, true, 0.28);
  const rawSnareOnsets = findOnsets(snareNovelty, frameSeconds, 0.14, 1.04, true, 0.4);
  const tempo = estimateTempo(bassOnsets.length >= 5 ? novelty : timingNovelty, frameSeconds);
  if (!tempo.bpm || timingOnsets.length < 5) {
    report(100);
    return new TrackAnalysis(buffer.duration, 0, 0, 0, new Float32Array(), new Float32Array(), new Uint8Array(), energy, frameSeconds);
  }

  const period = 60 / tempo.bpm;
  const phase = findPhase(bassOnsets.length >= 5 ? bassOnsets : timingOnsets, period);
  const beatTimes: number[] = [];
  const beatStrengths: number[] = [];
  const beatObserved: number[] = [];
  let timingStart = 0;
  let bassStart = 0;
  let timingMatched = 0;
  const tolerance = period * 0.14;
  for (let predicted = phase; predicted < buffer.duration; predicted += period) {
    while (timingStart < timingOnsets.length && timingOnsets[timingStart].time < predicted - tolerance) timingStart += 1;
    while (bassStart < bassOnsets.length && bassOnsets[bassStart].time < predicted - tolerance) bassStart += 1;
    let selectedTiming: Onset | undefined;
    let selectedBass: Onset | undefined;
    for (let index = timingStart; index < timingOnsets.length && timingOnsets[index].time <= predicted + tolerance; index += 1) {
      if (!selectedTiming || timingOnsets[index].strength > selectedTiming.strength) selectedTiming = timingOnsets[index];
    }
    for (let index = bassStart; index < bassOnsets.length && bassOnsets[index].time <= predicted + tolerance; index += 1) {
      if (!selectedBass || bassOnsets[index].strength > selectedBass.strength) selectedBass = bassOnsets[index];
    }
    const at = selectedBass?.time ?? predicted;
    const localEnergy = energy[clamp(Math.floor(predicted / frameSeconds), 0, energy.length - 1)] ?? 0;
    beatTimes.push(at);
    beatStrengths.push(selectedBass?.strength ?? 0.3 + localEnergy * 0.22);
    beatObserved.push(selectedBass ? 1 : 0);
    if (selectedTiming) timingMatched += 1;
  }
  const regularity = timingMatched / Math.max(beatTimes.length, 1);
  let spacingError = 0;
  for (let index = 1; index < beatTimes.length; index += 1) {
    spacingError += Math.abs(beatTimes[index] - beatTimes[index - 1] - period) / Math.max(period, 0.001);
  }
  const spacingConfidence = clamp(1 - spacingError / Math.max(beatTimes.length - 1, 1) / 0.18);
  const confidence = clamp(regularity * spacingConfidence * (timingOnsets.length >= 8 ? 0.98 : 0.72));
  const strengths = Float32Array.from(beatStrengths);
  const meter = inferMeter(strengths, confidence);
  const downbeats = new Uint8Array(strengths.length);
  if (meter.meter) for (let index = meter.offset; index < downbeats.length; index += meter.meter) downbeats[index] = 1;
  // Collect percussion independently, then score it against the learned beat. The shell
  // should answer the song's backbeat, while isolated vocal consonants remain detail.
  const snareCandidates: SnareCandidate[] = [];
  const snareTolerance = clamp(period * 0.11, 0.055, 0.11);
  for (const onset of rawSnareOnsets) {
    const beatIndex = Math.round((onset.time - phase) / period);
    const expected = phase + beatIndex * period;
    const distance = Math.abs(onset.time - expected);
    const timing = clamp(1 - distance / snareTolerance);
    if (timing < 0.45) continue;
    const candidate = { ...onset, timing };
    const previous = snareCandidates.length - 1;
    if (previous >= 0 && onset.time - snareCandidates[previous].time < 0.1) {
      if (candidate.strength * candidate.timing > snareCandidates[previous].strength * snareCandidates[previous].timing) {
        snareCandidates[previous] = candidate;
      }
      continue;
    }
    snareCandidates.push(candidate);
  }
  const snareTimes: number[] = [];
  const rawSnareStrengths: number[] = [];
  const snareConfidences: number[] = [];
  const repetitionSupport = (index: number) => {
    let support = 0;
    for (let other = 0; other < snareCandidates.length; other += 1) {
      if (other === index) continue;
      const distance = Math.abs(snareCandidates[other].time - snareCandidates[index].time);
      const beatsApart = Math.round(distance / period);
      if (beatsApart >= 1 && beatsApart <= 4 && Math.abs(distance - beatsApart * period) <= period * 0.1) support += 1;
      if (support >= 3) return support;
    }
    return support;
  };
  for (let index = 0; index < snareCandidates.length; index += 1) {
    const candidate = snareCandidates[index];
    const support = repetitionSupport(index);
    const exceptionallyClean = support >= 1 && candidate.timing >= 0.82 && candidate.transient >= 0.62;
    if (support < 2 && !exceptionallyClean) continue;
    const supportConfidence = support >= 3 ? 1 : support === 2 ? 0.82 : 0.64;
    const eventConfidence = clamp(candidate.timing * 0.48 + supportConfidence * 0.32 + candidate.transient * 0.2);
    snareTimes.push(candidate.time);
    rawSnareStrengths.push(candidate.strength * (0.7 + candidate.timing * 0.3));
    snareConfidences.push(eventConfidence);
  }
  // Normalize against this track rather than a universal loudness threshold.
  // Quiet, repeated snares can therefore remain expressive without making
  // isolated vocal consonants eligible for the prepared map.
  const quietSnare = percentile(rawSnareStrengths, 0.2);
  const loudSnare = percentile(rawSnareStrengths, 0.9);
  const strengthRange = Math.max(loudSnare - quietSnare, 0.08);
  const snareStrengths = rawSnareStrengths.map((strength) => clamp(0.52 + (strength - quietSnare) / strengthRange * 0.48, 0.46, 1));
  const percussionCoverage = snareCandidates.length ? snareTimes.length / snareCandidates.length : 0;
  const percussionDensity = clamp(snareTimes.length / Math.max(beatTimes.length * 0.2, 1));
  const percussionConfidence = snareTimes.length >= 3
    ? clamp(percussionCoverage * 0.45 + percussionDensity * 0.35 + 0.2)
    : 0;
  report(100);
  return new TrackAnalysis(
    buffer.duration, tempo.bpm, confidence, meter.meter, Float32Array.from(beatTimes), strengths, downbeats, energy, frameSeconds,
    Uint8Array.from(beatObserved), Float32Array.from(snareTimes), Float32Array.from(snareStrengths),
    percussionConfidence, Float32Array.from(snareConfidences),
  );
}
