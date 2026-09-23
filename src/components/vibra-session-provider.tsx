'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAudioPlayer } from '@/hooks/use-audio-player';

type Form = 'living-matter' | 'harmonic-shell';
type Palette = 'nocturne' | 'pearl' | 'mineral';
type Response = 'resting' | 'fluid' | 'charged';

function useSessionState() {
  const audio = useAudioPlayer();
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const [form, setForm] = useState<Form>('living-matter');
  const [palette, setPalette] = useState<Palette>('nocturne');
  const [response, setResponse] = useState<Response>('fluid');
  const [softness, setSoftness] = useState(0.5);
  const [impact, setImpact] = useState(1);
  const [flow, setFlow] = useState(1);
  const [gentle, setGentle] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState(false);

  // The home page is a quiet gallery. Keep the track and position, but do not
  // leave audio playing unexpectedly when the visitor returns from the studio.
  useEffect(() => {
    if (pathname === '/') audio.audioRef.current?.pause();
  }, [pathname, audio.audioRef]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return {
    ...audio,
    form, setForm, palette, setPalette, response, setResponse,
    softness, setSoftness, impact, setImpact, flow, setFlow,
    gentle, setGentle, showcaseTitle, setShowcaseTitle,
  };
}

type Session = ReturnType<typeof useSessionState>;
const SessionContext = createContext<Session | null>(null);

export function VibraSessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionState();
  // These are stable ref objects and event callbacks; no ref.current is read in render.
  // eslint-disable-next-line react-hooks/refs
  return <SessionContext.Provider value={session}>
    {children}
    {/* eslint-disable-next-line react-hooks/refs */}
    <audio ref={session.audioRef} {...session.audioEvents} preload="metadata" />
  </SessionContext.Provider>;
}

export function useVibraSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('VibraSessionProvider is required');
  return session;
}
