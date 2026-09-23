'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { PreludeArt } from './prelude-art';
import styles from '@/app/home.module.css';

const HeroScene = dynamic(() => import('./hero-scene'), { ssr: false });

export function HeroArtwork() {
  const artworkRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 640px)');
    const check = () => {
      let supported = false;
      if (!motion.matches && !narrow.matches) {
        try {
          const probe = document.createElement('canvas');
          const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
          supported = Boolean(context);
          context?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch { supported = false; }
      }
      setEnabled(supported);
      setFallbackVisible(!supported);
    };
    check();
    motion.addEventListener('change', check);
    narrow.addEventListener('change', check);
    return () => {
      motion.removeEventListener('change', check);
      narrow.removeEventListener('change', check);
    };
  }, []);

  useEffect(() => {
    if (!enabled || ready) return;
    const timeout = window.setTimeout(() => setFallbackVisible(true), 3500);
    return () => window.clearTimeout(timeout);
  }, [enabled, ready]);

  useEffect(() => {
    const artwork = artworkRef.current;
    if (!artwork) return;
    let inView = true;
    const sync = () => setActive(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(artwork);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return <div ref={artworkRef} className={styles.heroArtwork} aria-hidden="true">
    <div className={styles.heroHalo} />
    <div className={`${styles.heroPoster} ${fallbackVisible ? styles.heroPosterVisible : ''} ${ready && enabled ? styles.heroPosterHidden : ''}`}>
      <PreludeArt idPrefix="hero" animate />
    </div>
    {enabled && <div className={`${styles.heroCanvas} ${ready ? styles.heroCanvasReady : ''}`}>
      <HeroScene active={active} onReady={() => { setReady(true); setFallbackVisible(false); }} />
    </div>}
  </div>;
}
