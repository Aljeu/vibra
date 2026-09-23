'use client';

import { useEffect } from 'react';
import { interpolatePreludePath, preludePath } from './prelude-shape';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function ExhibitionScroll() {
  useEffect(() => {
    const exhibition = document.querySelector<HTMLElement>('[data-home-exhibition]');
    if (!exhibition) return;
    const chapters = [...exhibition.querySelectorAll<HTMLElement>('[data-gallery-chapter]')];
    const poster = exhibition.querySelector<HTMLElement>('[data-prelude-body]')?.closest('svg');
    const body = poster?.querySelector<SVGPathElement>('[data-prelude-body]');
    const clip = poster?.querySelector<SVGPathElement>('[data-prelude-clip]');
    const shell = poster?.querySelector<SVGPathElement>('[data-prelude-shell]');
    const light = poster?.querySelector<SVGGElement>('[data-prelude-light]');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let centers: number[] = [];
    let active: HTMLElement | null = null;
    let lastPath = '';

    const measure = () => {
      centers = chapters.map((chapter) => {
        const rect = chapter.getBoundingClientRect();
        return window.scrollY + rect.top + rect.height / 2;
      });
      schedule();
    };
    const render = () => {
      frame = 0;
      if (document.hidden || !centers.length) return;
      const focalPoint = window.scrollY + window.innerHeight * 0.52;
      let pose = 0;
      for (let index = 0; index < centers.length - 1; index++) {
        if (focalPoint >= centers[index]) pose = index + smooth((focalPoint - centers[index]) / Math.max(1, centers[index + 1] - centers[index]));
      }
      pose = Math.min(centers.length - 1, pose);
      if (motion.matches) pose = 0;
      exhibition.style.setProperty('--gallery-pose', pose.toFixed(4));

      const bottom = exhibition.getBoundingClientRect().bottom;
      const exit = smooth((window.innerHeight * 0.8 - bottom) / (window.innerHeight * 0.6));
      exhibition.style.setProperty('--gallery-exit', exit.toFixed(4));

      const nearest = chapters[Math.min(chapters.length - 1, Math.round(pose))];
      if (nearest !== active) {
        active?.setAttribute('data-active', 'false');
        nearest?.setAttribute('data-active', 'true');
        active = nearest;
      }

      if (body && clip && shell) {
        let path = preludePath('rest');
        if (pose >= 2 && pose < 3) path = interpolatePreludePath('rest', 'flow', smooth(pose - 2));
        else if (pose >= 3 && pose < 4) path = interpolatePreludePath('flow', 'charge', smooth(pose - 3));
        else if (pose >= 4) path = preludePath('charge');
        if (path !== lastPath) {
          body.setAttribute('d', path);
          clip.setAttribute('d', path);
          shell.setAttribute('d', path);
          lastPath = path;
        }
        poster?.parentElement?.style.setProperty('--shell-opacity', (smooth((pose - 4.6) / 1.2) * 0.55).toFixed(3));
        light?.setAttribute('transform', `translate(${(pose * 4).toFixed(1)} ${(pose * 2.5).toFixed(1)})`);
      }
    };
    function schedule() {
      if (!frame && !document.hidden) frame = window.requestAnimationFrame(render);
    }
    const onResize = () => measure();
    const onVisibility = () => { if (!document.hidden) schedule(); };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
