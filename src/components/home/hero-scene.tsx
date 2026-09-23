'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { installNocturneShader } from '@/lib/visual/nocturne-material';

type Shader = Parameters<THREE.MeshPhysicalMaterial['onBeforeCompile']>[0];

function LivingForm() {
  const group = useRef<THREE.Group>(null);
  const shaderRef = useRef<Shader | null>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const exhibitionRef = useRef<HTMLElement | null>(null);
  const time = useRef(0);
  useEffect(() => { exhibitionRef.current = document.querySelector<HTMLElement>('[data-home-exhibition]'); }, []);
  const compile = useCallback((shader: Shader) => {
    installNocturneShader(shader);
    shaderRef.current = shader;
  }, []);

  useFrame((state, delta) => {
    const form = group.current;
    if (!form) return;
    time.current += Math.min(delta, 0.05);
    const pose = Math.max(0, Math.min(6, Number(exhibitionRef.current?.style.getPropertyValue('--gallery-pose') || 0)));
    const transition = (from: number, to: number) => {
      const value = Math.max(0, Math.min(1, (pose - from) / (to - from)));
      return value * value * (3 - 2 * value);
    };
    const t = time.current;
    form.rotation.y = -0.3 + Math.sin(t * 0.23) * 0.13 + pose * 0.23;
    form.rotation.z = -0.13 + Math.sin(t * 0.31) * 0.05 - transition(2, 5) * 0.12;
    form.rotation.x = Math.sin(t * 0.18) * 0.06 + transition(3, 5) * 0.08;
    form.position.x = 0;
    form.position.y = Math.sin(t * 0.42) * 0.04;
    const fit = Math.min(1.15, state.viewport.width / 3.2, state.viewport.height / 3.2);
    const scale = fit * (1.09 + Math.sin(t * 0.48) * 0.014 + transition(1, 4) * 0.045);
    form.scale.setScalar(scale);
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = t * 1.3;
      shaderRef.current.uniforms.uShell.value = transition(4.5, 6) * 0.82;
      shaderRef.current.uniforms.uSub.value = transition(2, 3) * 0.09;
      shaderRef.current.uniforms.uBass.value = transition(3, 4) * 0.18;
      shaderRef.current.uniforms.uMids.value = transition(3, 5) * 0.12;
      shaderRef.current.uniforms.uTreble.value = transition(4, 5) * 0.16;
    }
    if (material.current) {
      material.current.roughness = 0.23 + transition(4, 6) * 0.1;
    }
  });

  return <group ref={group}>
    <mesh castShadow>
      <sphereGeometry args={[1.45, 96, 72]} />
      <meshPhysicalMaterial
        ref={material}
        color="#b9b5c0"
        metalness={0.2}
        roughness={0.23}
        clearcoat={0.82}
        clearcoatRoughness={0.18}
        onBeforeCompile={compile}
      />
    </mesh>
  </group>;
}

export default function HeroScene({ active, onReady }: { active: boolean; onReady: () => void }) {
  return <Canvas
    camera={{ position: [0, 0, 4.6], fov: 42 }}
    dpr={[1, 1.5]}
    gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
    onCreated={onReady}
    frameloop={active ? 'always' : 'never'}
  >
    <ambientLight intensity={1.4} color="#887b93" />
    <pointLight position={[-3, 3, 4]} color="#f4e7dd" intensity={74} distance={12} decay={2} />
    <pointLight position={[3, 0, 3]} color="#a8d2cc" intensity={35} distance={9} decay={2} />
    <pointLight position={[1, -3, -2]} color="#a783bc" intensity={56} distance={10} decay={2} />
    <LivingForm />
  </Canvas>;
}
