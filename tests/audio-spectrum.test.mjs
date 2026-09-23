import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectrumProcessor } from '../src/lib/audio/spectrum.ts';
import { BeatTracker } from '../src/lib/audio/beat-tracker.ts';
import { TrackAnalysis } from '../src/lib/audio/track-analysis.ts';

function spectrumAt(sampleRate, from, to, value = 220) {
  const spectrum = new Uint8Array(1024);
  for (let i = Math.ceil(from / (sampleRate / 2048)); i <= Math.floor(to / (sampleRate / 2048)); i++) spectrum[i] = value;
  return spectrum;
}

for (const sampleRate of [44100, 48000]) {
  test(`bass, midrange and high percussion stay separate at ${sampleRate}Hz`, () => {
    for (const [from, to, band, event] of [[45, 160, 'bass', 'kick'], [1800, 2300, 'mids', 'snare'], [5000, 10000, 'treble', 'highHit']]) {
      const processor = new SpectrumProcessor(sampleRate);
      const frame = processor.update(spectrumAt(sampleRate, from, to), 1 / 60);
      assert.ok(frame[band] > 0.2, `${band} should respond immediately`);
      assert.ok(frame[event] > 0.4, `${event} should have a clear attack`);
      for (const other of ['bass', 'mids', 'treble'].filter((value) => value !== band)) assert.equal(frame[other], 0);
      if (band !== 'bass') assert.equal(frame.kickId, 0, 'high sounds must not create false bass impacts');
      if (event === 'snare') assert.equal(frame.snareId, 1, 'a dedicated snare range should create one shell strike');
    }
  });
}

test('repeated kicks are detected; sustained bass does not repeatedly trigger', () => {
  const processor = new SpectrumProcessor();
  const kick = spectrumAt(48000, 45, 170);
  const silence = new Uint8Array(1024);
  for (let beat = 0; beat < 8; beat++) {
    for (let frame = 0; frame < 30; frame++) processor.update(frame < 7 ? kick : silence, 1 / 60);
  }
  assert.equal(processor.frame.kickId, 8);
  processor.reset();
  for (let frame = 0; frame < 180; frame++) processor.update(kick, 1 / 60);
  assert.equal(processor.frame.kickId, 1);
});

test('sustained vocal-range energy does not create shell strikes', () => {
  const processor = new SpectrumProcessor();
  const voice = spectrumAt(48000, 300, 1200, 220);
  for (let frame = 0; frame < 180; frame += 1) processor.update(voice, 1 / 60);
  assert.equal(processor.frame.snareId, 0);
  assert.ok(processor.frame.mids > 0.2);
});

test('the beat tracker gives the first plausible kick a pulse and learns a steady rhythm', () => {
  const tracker = new BeatTracker();
  let state = tracker.update(0.1, 0.8, 1 / 60, true);
  assert.equal(state.pulseId, 1, 'a first bass hit should never wait for tempo confidence');
  for (const time of [0.6, 1.1, 1.6, 2.1]) state = tracker.update(time, 0.8, 1 / 60, true);
  assert.equal(state.pulseId, 5);
  assert.ok(state.confidence > 0.7, 'repeated hits should establish a reliable pulse');
  const closeTransient = tracker.update(2.2, 0.8, 1 / 60, true);
  assert.equal(closeTransient.pulseId, 5, 'closely spaced low-frequency detail should not become another body beat');
});

test('a prepared beat map follows track time and marks a confident downbeat', () => {
  const map = new TrackAnalysis(
    2, 120, 0.9, 4,
    Float32Array.from([0, 0.5, 1, 1.5]),
    Float32Array.from([0.8, 0.55, 0.55, 0.55]),
    Uint8Array.from([1, 0, 0, 0]),
    Float32Array.from([0.25, 0.8, 0.4, 0.6]), 0.5,
    Uint8Array.from([1, 1, 1, 1]),
    Float32Array.from([0.5, 1.5]), Float32Array.from([0.9, 0.75]), 0.9,
  );
  const opening = map.sample(0.04);
  assert.equal(opening.beatId, 1);
  assert.equal(opening.downbeat, true);
  assert.ok(opening.pulse > 0.7);
  const nextBeat = map.sample(0.52);
  assert.equal(nextBeat.beatId, 2);
  assert.equal(nextBeat.downbeat, false);
  assert.ok(nextBeat.energy > 0.7);
  assert.equal(nextBeat.snareId, 1);
  assert.ok(nextBeat.snare > 0.7, 'the map should retain a short snare envelope at its strike');
  assert.ok(map.sample(0.9).snare < 0.05, 'the shell strike must decay before the next bar detail');
});

test('a bass impact is retained on top of a loud sustained mix', () => {
  const processor = new SpectrumProcessor();
  const background = spectrumAt(48000, 45, 170, 220);
  for (let frame = 0; frame < 120; frame++) processor.update(background, 1 / 60);
  assert.equal(processor.frame.kickId, 1);
  processor.update(spectrumAt(48000, 45, 170, 245), 1 / 60);
  assert.equal(processor.frame.kickId, 2);
  assert.ok(processor.frame.kick > 0.4);
});

test('envelope timing is consistent at 30, 60 and 120fps', () => {
  const values = [30, 60, 120].map((fps) => {
    const processor = new SpectrumProcessor();
    const kick = spectrumAt(48000, 45, 170);
    for (let i = 0; i < fps; i++) processor.update(kick, 1 / fps);
    for (let i = 0; i < fps / 2; i++) processor.update(new Uint8Array(1024), 1 / fps, false);
    return processor.frame.bass;
  });
  assert.ok(Math.max(...values) - Math.min(...values) < 0.005);
});

test('silence, reset and inactive playback leave no lingering motion; frame buffers stay stable', () => {
  const processor = new SpectrumProcessor();
  const frame = processor.frame;
  const fft = frame.fft;
  processor.update(spectrumAt(48000, 45, 170), 1 / 60);
  for (let i = 0; i < 300; i++) processor.update(fft, 1 / 60, false);
  assert.ok(frame.bass < 0.0001 && frame.kick < 0.0001);
  assert.equal(processor.frame, frame); assert.equal(processor.frame.fft, fft);
  processor.reset();
  assert.equal(frame.kickId, 0); assert.equal(frame.bass, 0); assert.ok(frame.kickAge >= 100);
});
