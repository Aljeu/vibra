# Vibra frontend handoff

Vibra is a frontend-only music visualizer with an editorial homepage at `/` and a local-audio studio at `/studio`. Enter the studio to choose a track and watch a pearlescent sculpture respond to it. The earlier prototype remains available at `/prototype` as a compatibility route.

## Design intent

Preserve the approved plum gallery, asymmetrical pearl form, editorial serif title, quiet monospace labels, and generous negative space. The sculpture is the first visual read. Bass changes its mass, midrange bends its posture lightly, and selected snares create a coherent surface ruffle. It must remain fluid and tactile, including at high intensity. Avoid generic dashboard cards, neon gradients, uncontrolled bloom, camera shake, and unrelated visual presets.

The title is the name of the artwork. The actual selected filename appears in the player. Do not confuse these two or invent track metadata. The quiet title is the default composition; an optional Showcase title frames the sculpture on wide screens. Instrument Serif, DM Sans, and DM Mono are bundled locally through Fontsource, so the active typography does not depend on fonts installed on the device or runtime font requests.

## Stack and active files

- Next.js App Router, React, TypeScript, Tailwind available, scoped CSS Modules.
- Three.js / React Three Fiber for GPU deformation and physical lighting.
- Web Audio API for local playback and analysis.
- `src/app/page.tsx` and `src/app/home.module.css` render the editorial homepage. The page remains server-rendered; its opening artwork is a small client island.
- `src/components/home/hero-artwork.tsx` and `hero-scene.tsx` provide one persistent, ambient sculpture from arrival through Forms. The WebGL scene loads separately, pauses outside view, and has an SVG fallback on small screens, reduced motion, or unsupported WebGL. It never samples audio.
- `src/components/home/gallery-journey.tsx` renders the editorial Rest → Flow → Charge → Structure chapters. `exhibition-scroll.tsx` maps normal page scroll to one continuous artwork pose, updates the SVG fallback without React frame rerenders, and fades the stage before the final cover.
- `src/components/home/prelude-art.tsx` and `prelude-shape.ts` define the reusable homepage sculpture and its three compatible silhouettes. Keep SVG definition IDs unique per instance. Ambient movement is slow, decorative, and independent of audio.
- `src/app/studio/page.tsx` renders the active visualizer. `src/app/prototype/page.tsx` remains a compatibility alias.
- `src/components/vibra-session-provider.tsx` holds the persistent in-memory audio session and Tune settings above both routes. It owns the single mounted `<audio>` element. Returning home pauses playback but keeps the track, playback position, and settings. A full reload resets this local session.
- `src/components/home-session-status.tsx` shows the unobtrusive paused-track return link on the homepage.
- `src/components/vibra-experience.tsx` owns the studio gallery, Tune controls, Focus Mode, drag/drop, and scene fallback.
- `src/components/vibra-experience.module.css` owns the active palette, typography, composition, and responsive states.
- `src/hooks/use-audio-player.ts` owns audio refs, file URLs, local preparation, playback/seek/volume, errors, and cleanup. It runs in the shared provider, not the studio route, so route changes do not revoke an active local track.
- `src/lib/audio-engine.ts` is the sole Web Audio graph. It routes source → analyser → gain → speakers so volume does not change visual intensity.
- `src/lib/audio/spectrum.ts` maps frequencies and derives envelopes and impacts. `src/lib/audio/beat-tracker.ts` turns plausible low-frequency onsets into a beat pulse during live fallback playback. `src/lib/audio/track-analysis.ts` decodes a local file before playback, performs an overlapping FFT pass, scores percussive spectral flux against a vocal band, maps bass onsets and repeated snare candidates, and builds a complete timing/event map before playback.
- `src/components/visualizers/nocturne.tsx` owns the scene, framing, spring recovery, palette interpolation, the Living Matter / Harmonic Shell surface transition, and animation.
- `src/lib/visual/nocturne-material.ts` defines the deformed surface and matching GPU normals.
- `tests/audio-spectrum.test.mjs` checks frequency separation, repeated versus sustained notes, envelope timing, silence, and buffer reuse.

The earlier `visualizer.tsx`, prism/lattice components, prototype stage wrapper, and prototype stylesheet are legacy studies preserved locally under `versions/legacy-source/`; they are excluded from the public source. Do not reintroduce their unrelated palette into the main experience. `/prototype` remains an intentional compatibility route and is not part of that archive.

The homepage is a gallery threshold into the studio: arrival, proposition, Rest → Flow → Charge → Structure, two related studies, then a final invitation. The fixed-position artwork is one continuous scene behind the scrolling editorial chapters; it ends before the solid-plum final cover. Keep the compact sticky header present throughout. Homepage motion is audio-independent; keep full audio-reactive Living Matter exclusive to `/studio`. Preserve normal scrolling, the `Enter the studio` links, first-screen mobile action visibility, reduced-motion behavior, and the dark plum / pearl typography. Use one WebGL canvas on the homepage, stop rendering outside view, and do not turn the homepage into a player, dashboard, or feature-card grid.

## Audio contract and boundaries

AudioEngine uses a 2048-point live FFT and frequency ranges in Hz, calculated from the actual sample rate. Sub-bass is 25–90Hz, bass 35–220Hz, live kick detection is 35–150Hz, mids 220–2400Hz, treble 2400–12000Hz, and the live snare detector focuses on 1800–6000Hz while comparing against a 250–1600Hz vocal band. The pre-playback map uses 1024-sample overlapping FFT windows to distinguish percussive flux from sustained/harmonic energy, then admits shell strikes only when they have tight beat timing plus repeated support or exceptionally clean transient evidence. Accepted strengths are normalized against the track's own snare range and retain event-level confidence. Impacts are spectral-rise estimates, not semantic instrument recognition or a claimed BPM detector. Dense mixes and mastered/compressed recordings may need further calibration.

`sample(deltaSeconds)` returns a stable mutable AudioFrame:
- inherited bass, mids, treble, energy, and FFT byte buffer;
- subBass, kick, snare, highHit;
- kickId, kickAge, kickStrength, plus snareId, snareAge, snareStrength, snareConfidence, and snarePrepared;
- beat, beatId, beatStrength, beatConfidence, and beatPhase; `beatConfidence` is local to the current mapped beat, so inferred timing is weaker than a confirmed onset;
- beatObserved, which distinguishes a confirmed low-frequency onset from an inferred timing fill;
- downbeat and trackEnergy, which are populated from a prepared track map when available;
- a reusable time-domain waveform buffer.

The active scene calls sample once per visual frame. Do not add another sampling loop in React. A prepared map provides phase whenever a usable tempo exists. Confirmed beat impacts require local confidence of at least 0.55, while uncertain or inferred timing creates a low amplitude rhythmic breath. Prepared snares are routed by event-level timing, repetition, and transient confidence; global percussion confidence may scale certainty but must not erase an otherwise valid mapped event. Track-relative normalization makes quiet genuine snares visually useful without lowering vocal rejection. When the prepared map is sparse or uncertain, a live snare may fill a gap only if it is fresh, strong, close to the learned beat, and not near a prepared event. AudioEngine deduplicates both sources into one monotonic routed snare ID. `beatObserved` must gate physical kick motion; inferred timing fills may preserve phase and drive the quiet rhythmic floor but must not strike the sculpture. Do not detect kicks by comparing heavily smoothed values or by frame-count thresholds. The live pulse is deliberately immediate for plausible bass hits; confidence adjusts its timing and supports occasional missing beats, but must not mute valid first hits. Envelopes and cooldowns must use elapsed seconds. If storing history, copy scalars: the frame and its buffers are reused.

Keep the audio graph and preparation pass local. Do not add authentication, databases, cloud uploads, API routes, telemetry, or backend-agent instructions. The preparation pass is intentionally cancellable when a new file replaces the current one, and should yield periodically so the interface remains responsive. Never create a second media source for the same audio element. Preserve URL revocation, race protection when replacing files, context disposal, and user-gesture playback.

## Motion and rendering conventions

- Use refs and useFrame for transient values. UI progress comes from media events, not animation-frame React state.
- Deform vertices on the GPU. Recalculate normals from the same surface before Three's normal transform; stale normals make highlights disconnect from motion.
- Keep the motion hierarchy strict: sub-bass/bass controls mass, kick controls a small compression, routed snare confidence selects probable/confirmed visual tiers, and low-confidence phase controls a much quieter breath. Mids and vocals may affect only a restrained posture/material treatment; full-spectrum `energy` and `trackEnergy` must never drive scale or major geometry.
- Bound deformation and intensity. Tune exposes Resting (0.62), Fluid (1.15, default), and Charged (1.55) response modes; the advanced layer exposes softness, snare impact, and flow.
- Use delta-time spring integration. Substep long frames; avoid allocating vectors or typed arrays per frame.
- Do not turn every beat, vocal, or high-frequency transient into a global scale pulse. Kicks give a small mass-preserving compression. A routed `snareId` briefly amplifies coherent surface noise in `nocturne-material.ts`, creating a visible contour ruffle while the sculpture's center, framing, scale, and camera stay stable. Prepared tempo/onset analysis must remain bass-led and must not use full-spectrum vocal energy to invent beats.
- Keep lights stable in world space while the sculpture moves.
- Living Matter and Harmonic Shell share one material, scene, and audio sample. The shader morphs between organic and ribbed surfaces; do not reintroduce raw wireframe geometry as the finished secondary artwork. Nocturne, Pearl, and Mineral are lighting studies within the same plum environment.
- R3F manages declarative material/geometry disposal. Dispose generated environment textures explicitly.
- DPR is capped at 1.5. Fit the object to narrow viewports, leaving room for transient expansion.
- Stop the render loop while the document is hidden.
- Respect system reduced-motion preference; Gentle motion also offers manual attenuation. Idle spin/time freezes in that mode.
- Keep an understandable scene failure state while retaining usable audio controls.

## Adding future visualizers

1. Add a typed scene under `src/components/visualizers/`.
2. Reuse the existing engine and AudioFrame semantics.
3. Give it the same gallery lighting, pearlescent palette, and deliberate motion grammar.
4. Keep frequency analysis out of geometry/material code.
5. Validate actual playback, silence, loud transients, reduced motion, and phone framing before exposing a selector.

## UI conventions

Functional controls need readable labels, visible focus, and touch targets around 44px. Keep the long filename truncated in its original casing while the times remain visible. Disable seeking until duration is finite. Space toggles playback and F toggles Focus Mode when focus is outside editable controls. The desktop Tune popover and mobile bottom sheet expose Form, Response, and Volume first; surface, material, Gentle motion, orientation reset, and Showcase title are secondary. Focus Mode keeps a quiet exit control visible and returns keyboard focus to the invoking control on exit. The player offers add/change directly and remove through Track options. No playback should start before the user selects a file or presses play.

## Verification

```sh
npm run test:audio
npm run typecheck
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Node 22.6+ is required by the audio test command's TypeScript stripping. A module-type detection warning in that isolated test is harmless; do not change the whole package module mode merely to suppress it.

Development can use `npm run dev`. If the host runs out of watcher handles, use `WATCHPACK_POLLING=true npm run dev -- --webpack --hostname 127.0.0.1 --port 3000`.

Check local upload, replacement, unsupported files, play/pause, seeking, end-of-track, volume, long names, title modes, Tune, fullscreen, keyboard focus, narrow phones, and the no-WebGL state. Use generated test audio or owner-provided tracks. Never browse or upload unrelated personal media.

## Recommended next work

1. Calibrate the response on representative tracks chosen by the owner: bass-heavy, acoustic, vocal, sparse percussion, and dense/compressed mixes.
2. Profile frame times and thermal behavior on actual midrange mobile hardware.
3. Refine the two surface silhouettes and lighting studies using desktop, mobile, grayscale, and reduced-specular visual comparisons.
4. Add another form only after it fits the established material and motion language.
