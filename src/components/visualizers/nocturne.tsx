'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AudioEngine } from '@/lib/audio-engine';
import { installNocturneShader } from '@/lib/visual/nocturne-material';

const PALETTES = {
  nocturne: { body: new THREE.Color('#a99bb2'), sheen: new THREE.Color('#9b88aa'), key: new THREE.Color('#d9c7df'), rim: new THREE.Color('#79aaa7'), warmth: new THREE.Color('#c99d89') },
  pearl: { body: new THREE.Color('#d5c3c0'), sheen: new THREE.Color('#d3ada8'), key: new THREE.Color('#ead6d2'), rim: new THREE.Color('#a6bfbb'), warmth: new THREE.Color('#d9ad93') },
  mineral: { body: new THREE.Color('#93aaa6'), sheen: new THREE.Color('#8ba8a7'), key: new THREE.Color('#bccaca'), rim: new THREE.Color('#81aaa4'), warmth: new THREE.Color('#c4a5a0') },
} as const;

export type NocturneProps = {
  engineRef: RefObject<AudioEngine | null>;
  intensity: number;
  reducedMotion: boolean;
  visible: boolean;
  rotationRef: RefObject<{ x: number; y: number; vx: number; vy: number; dragging: boolean }>;
  softness: number;
  impact: number;
  flow: number;
  palette: 'nocturne' | 'pearl' | 'mineral';
  form: 'living-matter' | 'harmonic-shell';
};

let webglSupport: boolean | null = null;
const subscribeToWebglSupport = () => () => undefined;
const getServerWebglSupport = () => null;
function getWebglSupport() {
  if (webglSupport !== null) return webglSupport;
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  webglSupport = Boolean(context);
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return webglSupport;
}

function GalleryLight() {
  const { gl, get } = useThree();
  useEffect(() => {
    const scene = get().scene;
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromScene(room, 0.055);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.34;
    room.dispose();
    generator.dispose();
    return () => { scene.environment = null; environment.dispose(); };
  }, [gl, get]);
  return null;
}

function Sculpture({ engineRef, intensity, reducedMotion, rotationRef, softness, impact, flow, palette, form }: NocturneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const keyLightRef = useRef<THREE.PointLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);
  const warmLightRef = useRef<THREE.PointLight>(null);
  const shaderRef = useRef<Parameters<THREE.MeshPhysicalMaterial['onBeforeCompile']>[0] | null>(null);
  const motionRef = useRef({
    body: 0, mids: 0, treble: 0, kickPulse: 0, kickVelocity: 0,
    snareImpact: 0, snareAge: 100, rhythmPulse: 0, spin: 0, time: 0,
    lastBeat: 0, lastSnare: 0, direction: 1, snareDirection: 1, formMix: 0,
  });
  const compile = useCallback((shader: Parameters<THREE.MeshPhysicalMaterial['onBeforeCompile']>[0]) => {
    installNocturneShader(shader);
    shaderRef.current = shader;
  }, []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const frame = engineRef.current?.sample(dt);
    const strength = intensity * (reducedMotion ? 0.12 : 1);
    const motion = motionRef.current;
    if (frame && frame.beatObserved && frame.beatId !== motion.lastBeat) {
      motion.lastBeat = frame.beatId;
      motion.direction *= -1;
      motion.kickVelocity += 2.6 + frame.beatStrength * 1.9 + (frame.downbeat ? 0.45 : 0);
    }
    if (frame && frame.snareId > 0 && frame.snareConfidence >= 0.5 && frame.snareAge <= 0.18 && frame.snareId !== motion.lastSnare) {
      motion.lastSnare = frame.snareId;
      motion.snareDirection *= -1;
      // Confidence selects a visual tier; normalized track-relative loudness
      // then varies the strike within that tier. Probable events remain clear,
      // while confirmed accents produce the full pinch and recoil.
      const tier = frame.snareConfidence >= 0.8 ? 1 : frame.snareConfidence >= 0.64 ? 0.72 : 0.48;
      const strikeAccent = Math.max(0, Math.min(1, (frame.snareStrength - 0.52) / 0.48));
      const strike = tier * (2.1 + frame.snareStrength * 1.5 + strikeAccent * 1.2);
      motion.snareImpact = Math.max(motion.snareImpact, strike);
      motion.snareAge = 0;
    }
    const settle = (value: number, target: number, seconds: number) => value + (target - value) * (1 - Math.exp(-dt / seconds));
    const rhythmConfidence = frame?.beatConfidence ?? 0;
    const uncertainRhythm = frame && frame.beatId > 0 && (!frame.beatObserved || rhythmConfidence < 0.55);
    const rhythmTarget = uncertainRhythm
      ? Math.exp(-(frame?.beatPhase ?? 1) / 0.42) * (0.11 + (1 - rhythmConfidence) * 0.2) * (frame?.downbeat ? 1.08 : 1)
      : 0;
    motion.rhythmPulse = settle(motion.rhythmPulse, rhythmTarget, 0.1);
    // Geometry listens to low-frequency mass only. Full-spectrum energy remains
    // available for diagnostics, but vocals must not expand or steer the sculpture.
    const bodyTarget = (frame?.subBass ?? 0) * 0.74 + (frame?.bass ?? 0) * 0.26;
    motion.body = settle(motion.body, bodyTarget, 0.48);
    motion.mids = settle(motion.mids, frame?.mids ?? 0, 0.3);
    motion.treble = settle(motion.treble, frame?.treble ?? 0, 0.36);
    // Kicks remain weighty. Snares stay entirely on the surface so the object
    // remains anchored like the reference visualizer.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const step = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      motion.kickVelocity += (-motion.kickPulse * 42 - motion.kickVelocity * 10.5) * step;
      motion.kickPulse += motion.kickVelocity * step;
    }
    motion.kickPulse = Math.max(-0.18, Math.min(0.62, motion.kickPulse));
    motion.snareImpact *= Math.exp(-dt / (0.16 + softness * 0.08));
    motion.snareAge += dt;
    motion.formMix = settle(motion.formMix, form === 'harmonic-shell' ? 1 : 0, 0.18);
    const body = motion.body * strength;
    // Mids can tint posture very lightly, but never compete with bass or snare motion.
    const mids = motion.mids * strength * 0.16;
    const treble = motion.treble * strength;
    const kickPulse = motion.kickPulse * strength;
    const snareImpact = motion.snareImpact * strength;
    const rhythmPulse = motion.rhythmPulse * strength;
    if (!reducedMotion) {
      motion.time += dt * flow;
      motion.spin += dt * (0.035 + motion.body * 0.055 + motion.mids * 0.008);
    }
    const shader = shaderRef.current;
    if (shader) {
      const u = shader.uniforms;
      u.uTime.value = motion.time;
      u.uBass.value = body; u.uSub.value = body; u.uMids.value = mids;
      u.uTreble.value = treble;
      u.uKick.value = kickPulse;
      u.uSnareImpact.value = snareImpact * impact;
      u.uHigh.value = treble * 0.25;
      u.uSnareAge.value = motion.snareAge;
      u.uSnareDirection.value = motion.snareDirection;
      u.uShell.value = motion.formMix;
    }
    const fit = Math.min(1, state.viewport.width / 3.35, state.viewport.height / 3.45);
    group.scale.set(
      fit * (1 + body * 0.04 + kickPulse * 0.045 + rhythmPulse * 0.02),
      fit * (1 + body * 0.022 - kickPulse * 0.038 - rhythmPulse * 0.025),
      fit * (1 + body * 0.03 + kickPulse * 0.035 + rhythmPulse * 0.028),
    );
    const rotation = rotationRef.current;
    if (rotation && !rotation.dragging && !reducedMotion) {
      rotation.x = Math.max(-1.15, Math.min(1.15, rotation.x + rotation.vx * dt));
      rotation.y += rotation.vy * dt;
      const damping = Math.exp(-dt * 4.5);
      rotation.vx *= damping; rotation.vy *= damping;
    }
    group.rotation.set((rotation?.x ?? 0) + Math.sin(motion.time * 0.19) * (0.022 + body * 0.015) + mids * 0.018, (rotation?.y ?? 0) + motion.spin, Math.sin(motion.time * 0.12) * 0.018 + motion.direction * kickPulse * 0.015 + rhythmPulse * 0.006);
    group.position.set(Math.sin(motion.time * 0.42) * (0.02 + body * 0.025) + motion.direction * kickPulse * 0.012 * fit, 0.12 + Math.sin(motion.time * 0.31) * (0.018 + body * 0.02) - kickPulse * 0.012 * fit - rhythmPulse * 0.008 * fit, 0);
    const paletteTarget = PALETTES[palette];
    const colorMix = 1 - Math.exp(-dt / 0.36);
    if (materialRef.current) {
      materialRef.current.color.lerp(paletteTarget.body, colorMix);
      materialRef.current.sheenColor.lerp(paletteTarget.sheen, colorMix);
      materialRef.current.roughness = 0.37 + motion.formMix * 0.06 - treble * 0.012 - snareImpact * 0.022;
      materialRef.current.iridescence = 0.16 + treble * 0.035 + snareImpact * 0.045;
    }
    keyLightRef.current?.color.lerp(paletteTarget.key, colorMix);
    rimLightRef.current?.color.lerp(paletteTarget.rim, colorMix);
    warmLightRef.current?.color.lerp(paletteTarget.warmth, colorMix);
    if (rimLightRef.current) rimLightRef.current.intensity = 4.7 + treble * 0.65 + body * 0.55;
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[1, 96, 64]} />
          <meshPhysicalMaterial
            ref={materialRef} color="#a99bb2" roughness={0.37} metalness={0.14}
            clearcoat={0.68} clearcoatRoughness={0.26} sheen={0.27} sheenColor="#9b88aa"
            iridescence={0.16} iridescenceIOR={1.35} iridescenceThicknessRange={[180, 340]}
            onBeforeCompile={compile} customProgramCacheKey={() => 'vibra-living-matter-v5'}
          />
        </mesh>
      </group>
      <pointLight ref={keyLightRef} position={[2.8, 2.2, 3]} color="#d9c7df" intensity={10.5} distance={8} />
      <pointLight ref={rimLightRef} position={[-2.6, -0.8, 2]} color="#79aaa7" intensity={4.7} distance={7} />
      <pointLight ref={warmLightRef} position={[-1.5, 2.7, -2]} color="#c99d89" intensity={2.8} distance={7} />
    </>
  );
}

export default function NocturneStage(props: NocturneProps) {
  const webglAvailable = useSyncExternalStore(
    subscribeToWebglSupport,
    getWebglSupport,
    getServerWebglSupport,
  );

  if (webglAvailable === null) return null;
  if (!webglAvailable) {
    return (
      <div className="webglFallback" role="status">
        The artwork needs WebGL. Audio playback is still available.
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 4.9], fov: 36 }} dpr={[1, 1.5]}
      frameloop={props.visible ? 'always' : 'never'}
      fallback={<span aria-hidden="true" />}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor('#000000', 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }}
    >
      <GalleryLight />
      <ambientLight intensity={0.3} color="#b7a9c3" />
      <directionalLight position={[2, 3, 4]} color="#fff2e6" intensity={1.15} />
      <Sculpture {...props} />
    </Canvas>
  );
}
