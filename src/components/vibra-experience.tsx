'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Component, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useVibraSession } from '@/components/vibra-session-provider';
import styles from './vibra-experience.module.css';

const NocturneStage = dynamic(() => import('@/components/visualizers/nocturne'), {
  ssr: false, loading: () => <div className={styles.stageLoading} role="status">Preparing the artwork</div>,
});

class ArtworkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className={styles.fallback} role="status">
      <span>The artwork could not load. Your audio player is still available.</span>
      <button type="button" onClick={() => this.setState({ failed: false })}>Try the artwork again ↗</button>
    </div> : this.props.children;
  }
}

function InfoTip({ label, children, align = 'right' }: { label: string; children: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    if (pinned) return;
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setPosition(null);
    }, 180);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const placeTooltip = () => {
      const anchor = trigger.getBoundingClientRect();
      const bubble = tooltip.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const margin = 12;
      const gap = 8;
      const bubbleWidth = Math.min(bubble.width, viewportWidth - margin * 2);
      const leftPreference = align === 'left' ? anchor.left : anchor.right - bubbleWidth;
      const left = Math.max(margin, Math.min(leftPreference, viewportWidth - bubbleWidth - margin));
      const belowSpace = viewportHeight - anchor.bottom - gap - margin;
      const aboveSpace = anchor.top - gap - margin;
      const placeBelow = bubble.height <= belowSpace || belowSpace >= aboveSpace;
      const topPreference = placeBelow ? anchor.bottom + gap : anchor.top - bubble.height - gap;
      const top = Math.max(margin, Math.min(topPreference, viewportHeight - bubble.height - margin));
      setPosition({ left, top });
    };

    placeTooltip();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placeTooltip);
    observer?.observe(tooltip);
    window.addEventListener('resize', placeTooltip);
    window.addEventListener('scroll', placeTooltip, true);
    window.visualViewport?.addEventListener('resize', placeTooltip);
    window.visualViewport?.addEventListener('scroll', placeTooltip);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', placeTooltip);
      window.removeEventListener('scroll', placeTooltip, true);
      window.visualViewport?.removeEventListener('resize', placeTooltip);
      window.visualViewport?.removeEventListener('scroll', placeTooltip);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open || !pinned) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) return;
      setPinned(false);
      setOpen(false);
      setPosition(null);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open, pinned]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const tooltip = open && typeof document !== 'undefined' ? createPortal(
    <span
      ref={tooltipRef}
      id={tooltipId}
      className={styles.infoPopover}
      role="tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >{children}</span>,
    document.body,
  ) : null;

  return <>
    <span className={styles.infoTip} data-open={open}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.infoButton}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        title={`About ${label}`}
        onMouseEnter={() => { cancelClose(); setPosition(null); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onFocus={() => { cancelClose(); setPosition(null); setOpen(true); }}
        onBlur={scheduleClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelClose();
            setPinned(false);
            setOpen(false);
            setPosition(null);
          }
        }}
        onClick={() => {
          cancelClose();
          const next = !pinned;
          setPinned(next);
          setOpen(next);
          setPosition(null);
        }}
      ><span aria-hidden="true">?</span></button>
    </span>
    {tooltip}
  </>;
}

function Icon({ name }: { name: 'play' | 'pause' | 'expand' | 'arrow' | 'tune' | 'close' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    {name === 'play' && <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />}
    {name === 'pause' && <path d="M9 5v14M16 5v14" strokeWidth="2" />}
    {name === 'expand' && <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />}
    {name === 'arrow' && <path d="M5 19 19 5M6 5h13v13" />}
    {name === 'tune' && <><path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>}
    {name === 'close' && <path d="M5 5 19 19M19 5 5 19" />}
  </svg>;
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function ListeningState({ progress }: { progress: number }) {
  return <div className={styles.listeningState} role="status" aria-live="polite">
    <span>Listening for the pulse</span>
    <p>Mapping rhythm, bass, and energy</p>
    <div className={styles.listeningRule} role="progressbar" aria-label="Track analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <i style={{ transform: `scaleX(${progress / 100})` }} />
    </div>
    <em>{progress}%</em>
  </div>;
}

export default function VibraExperience() {
  const {
    engineRef, fileInputRef, track, playing, loading, progress, duration, volume, error: audioError, preparation, preparationProgress,
    loadTrack, removeTrack, togglePlayback, seek, setVolume,
    showcaseTitle, setShowcaseTitle, response, setResponse, softness, setSoftness, impact, setImpact,
    flow, setFlow, palette, setPalette, form, setForm, gentle, setGentle,
  } = useVibraSession();
  const rootRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const focusExitRef = useRef<HTMLButtonElement>(null);
  const hasEnteredFocusRef = useRef(false);
  const dragDepthRef = useRef(0);
  const rotationRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, dragging: false });
  const pointerRef = useRef({ x: 0, y: 0, time: 0 });
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusControls, setFocusControls] = useState(true);
  const intensity = { resting: 0.62, fluid: 1.15, charged: 1.55 }[response];
  const [systemReduced, setSystemReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [rotationHint, setRotationHint] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setSystemReduced(preference.matches);
    const syncVisibility = () => setVisible(document.visibilityState === 'visible');
    const syncFullscreen = () => { if (!document.fullscreenElement) setFocusMode(false); };
    syncMotion(); syncVisibility();
    preference.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      preference.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => () => { if (focusTimerRef.current) clearTimeout(focusTimerRef.current); }, []);
  useEffect(() => { if (focusMode && detailsRef.current) detailsRef.current.open = false; }, [focusMode]);
  useEffect(() => {
    if (focusMode) {
      hasEnteredFocusRef.current = true;
      focusExitRef.current?.focus();
    } else if (hasEnteredFocusRef.current) {
      const frame = requestAnimationFrame(() => focusButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [focusMode]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  const revealFocusControls = useCallback(() => {
    setFocusControls(true);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setFocusControls(false), 2400);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    setScreenError('');
    try {
      if (focusMode) {
        setFocusMode(false);
        if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      } else {
        setFocusMode(true);
        revealFocusControls();
        if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      }
    } catch { setScreenError('Browser fullscreen is unavailable; focus mode is still active.'); }
  }, [focusMode, revealFocusControls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector('summary')?.focus();
        return;
      }
      if (event.key === 'Escape' && focusMode && !document.fullscreenElement) { setFocusMode(false); return; }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); void toggleFullscreen(); return; }
      if (event.target instanceof HTMLElement && event.target.closest('button, summary')) return;
      if (event.code === 'Space') { event.preventDefault(); void togglePlayback(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlayback, toggleFullscreen, focusMode]);

  const error = audioError || screenError;
  return (
    <main ref={rootRef} className={styles.experience} data-playing={playing} data-dragging={dragging} data-focus={focusMode} data-focus-controls={focusControls} data-tune-open={tuneOpen} data-showcase={showcaseTitle}
      onPointerMove={() => { if (focusMode) revealFocusControls(); }}
      onTouchStart={() => { if (focusMode) revealFocusControls(); }}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault(); dragDepthRef.current += 1; setDragging(true);
      }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
      onDragLeave={() => { dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (!dragDepthRef.current) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault(); dragDepthRef.current = 0; setDragging(false);
        void loadTrack(event.dataTransfer.files[0]);
      }}
    >
      <div className={styles.atmosphere} aria-hidden="true" />
      <section className={styles.stage} aria-label="Music-reactive sculpture. Drag to rotate." aria-busy={preparation === 'analyzing'}
        onPointerDown={(event) => {
          if (event.target instanceof HTMLCanvasElement) {
            event.currentTarget.setPointerCapture(event.pointerId);
            rotationRef.current.dragging = true;
            rotationRef.current.vx = 0; rotationRef.current.vy = 0;
            pointerRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
          }
        }}
        onPointerMove={(event) => {
          if (!rotationRef.current.dragging) return;
          const now = performance.now();
          const dx = event.clientX - pointerRef.current.x;
          const dy = event.clientY - pointerRef.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3 && rotationHint) setRotationHint(false);
          const dt = Math.max(16, now - pointerRef.current.time) / 1000;
          rotationRef.current.y += dx * 0.006;
          rotationRef.current.x = Math.max(-1.15, Math.min(1.15, rotationRef.current.x + dy * 0.006));
          rotationRef.current.vy = Math.max(-2.5, Math.min(2.5, dx * 0.006 / dt));
          rotationRef.current.vx = Math.max(-2.5, Math.min(2.5, dy * 0.006 / dt));
          pointerRef.current = { x: event.clientX, y: event.clientY, time: now };
        }}
        onPointerUp={() => { rotationRef.current.dragging = false; }}
        onPointerCancel={() => { rotationRef.current.dragging = false; }}
      >
        <ArtworkBoundary><NocturneStage engineRef={engineRef} intensity={intensity} reducedMotion={gentle || systemReduced} visible={visible} rotationRef={rotationRef} softness={softness} impact={impact} flow={flow} palette={palette} form={form} /></ArtworkBoundary>
        {preparation === 'analyzing' ? <ListeningState progress={preparationProgress} /> : null}
        {rotationHint && preparation !== 'analyzing' && !focusMode ? <span className={styles.rotationHint} aria-hidden="true">Drag to turn</span> : null}
      </section>

      <header className={styles.header} inert={focusMode}>
        <Link className={styles.wordmark} href="/" prefetch={false} aria-label="Vibra — return to homepage" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); }}>vibra<span aria-hidden="true">✳</span></Link>
        <div className={styles.headerActions}>
          <details ref={detailsRef} className={styles.settings} onToggle={(event) => setTuneOpen(event.currentTarget.open)}>
            <summary aria-label="Tune sound and motion"><Icon name="tune" /><span>Tune</span></summary>
            <div className={styles.settingsPanel}>
              <div className={styles.panelHeading}><p className={styles.settingsTitle}>Tune the form.</p><button type="button" className={styles.panelClose} onClick={() => { if (detailsRef.current) detailsRef.current.open = false; detailsRef.current?.querySelector('summary')?.focus(); }} aria-label="Close Tune"><Icon name="close" /></button></div>
              <fieldset className={styles.choiceGroup}><legend><span>01 / Form</span><InfoTip label="Form" align="left">Choose the sculpture’s shape and surface style.</InfoTip></legend>
                <div className={styles.formChoices}>
                  <button type="button" aria-label="Living Matter, study one" aria-pressed={form === 'living-matter'} onClick={() => setForm('living-matter')}><span className={styles.formOrb} aria-hidden="true" /><span><strong>Living matter</strong><small>Study 01</small></span></button>
                  <button type="button" aria-label="Harmonic Shell, study two" aria-pressed={form === 'harmonic-shell'} onClick={() => setForm('harmonic-shell')}><span className={styles.formShell} aria-hidden="true" /><span><strong>Harmonic shell</strong><small>Study 02</small></span></button>
                </div>
              </fieldset>
              <fieldset className={styles.choiceGroup}><legend><span>02 / Response</span><InfoTip label="Response" align="left">Choose how restrained or energetic the sculpture feels as it follows the music.</InfoTip></legend>
                <div className={styles.responseChoices}>
                  {(['resting', 'fluid', 'charged'] as const).map((mode) => <button key={mode} type="button" aria-label={`${mode} response`} aria-pressed={response === mode} onClick={() => setResponse(mode)}>{mode}</button>)}
                </div>
              </fieldset>
              <div className={styles.volumeGroup}><div className={styles.settingLine}><label htmlFor="audio-volume">Volume</label><output>{Math.round(volume * 100)}%</output><InfoTip label="Volume">Adjusts the track’s playback volume.</InfoTip></div><input id="audio-volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
              <details className={styles.advanced}><summary><span>Surface &amp; material</span><span aria-hidden="true">+</span></summary><div className={styles.advancedContent}>
                <p className={styles.advancedIntro}>Fine controls for the sculpture’s response, movement, color, and view.</p>
                <div className={styles.settingLine}><label htmlFor="surface-softness">Softness</label><output>{Math.round(softness * 100)}%</output><InfoTip label="Softness">Controls how quickly a snare ripple settles back into the surface.</InfoTip></div>
                <input id="surface-softness" type="range" min="0" max="1" step="0.05" value={softness} onChange={(event) => setSoftness(Number(event.target.value))} />
                <div className={styles.settingLine}><label htmlFor="strike-impact">Impact</label><output>{Math.round(impact * 100)}%</output><InfoTip label="Impact">Sets how pronounced the detected snare strikes appear on the surface.</InfoTip></div>
                <input id="strike-impact" type="range" min="0.5" max="1.5" step="0.05" value={impact} onChange={(event) => setImpact(Number(event.target.value))} />
                <div className={styles.settingLine}><label htmlFor="surface-flow">Flow</label><output>{Math.round(flow * 100)}%</output><InfoTip label="Flow">Changes the pace of the sculpture’s continuous ambient movement.</InfoTip></div>
                <input id="surface-flow" type="range" min="0.5" max="1.5" step="0.05" value={flow} onChange={(event) => setFlow(Number(event.target.value))} />
                <p className={styles.advancedLabel}><span>Light study</span><InfoTip label="Light study" align="left">Changes the sculpture’s color palette and surrounding light.</InfoTip></p>
                <div className={styles.paletteChoices}>
                  {(['nocturne', 'pearl', 'mineral'] as const).map((light) => <button type="button" key={light} aria-label={`${light} light study`} aria-pressed={palette === light} onClick={() => setPalette(light)}><i className={styles[light]} aria-hidden="true" />{light}</button>)}
                </div>
                <div className={styles.resetLine}><button className={styles.resetView} type="button" onClick={() => { rotationRef.current.x = 0; rotationRef.current.y = 0; rotationRef.current.vx = 0; rotationRef.current.vy = 0; }}>Reset orientation</button><InfoTip label="Reset orientation">Returns the sculpture to its original viewing angle.</InfoTip></div>
                <div className={styles.toggleLine}><label className={styles.gentle}><span>Gentle motion</span><input type="checkbox" checked={gentle || systemReduced} disabled={systemReduced} onChange={(event) => setGentle(event.target.checked)} /></label><InfoTip label="Gentle motion">Reduces the sculpture’s movement intensity. Your device’s reduced-motion preference takes priority.</InfoTip></div>
                <div className={`${styles.toggleLine} ${styles.showcaseControl}`}><label className={styles.gentle}><span>Showcase title</span><input type="checkbox" checked={showcaseTitle} onChange={(event) => setShowcaseTitle(event.target.checked)} /></label><InfoTip label="Showcase title">Shows a larger title composition on wide screens; hidden on mobile.</InfoTip></div>
              </div></details>
              <small>{systemReduced ? 'Following your device’s reduced motion preference.' : 'Drag to turn · Space to play · F for focus'}</small>
            </div>
          </details>
          <button ref={focusButtonRef} className={styles.fullscreenButton} type="button" onClick={toggleFullscreen} aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'} title={focusMode ? 'Exit focus mode' : 'Enter focus mode'}><Icon name="expand" /></button>
        </div>
      </header>

      <section className={`${styles.titleComposition} ${showcaseTitle ? styles.showcaseTitle : styles.quietTitle}`} aria-label={form === 'living-matter' ? 'Prismatic Nocturne' : 'Harmonic Shell'}>
        {!showcaseTitle && <span className={styles.eyebrow}>STUDY {form === 'living-matter' ? '01' : '02'} · SOUND AS FORM</span>}
        <h1 tabIndex={-1}><span>{form === 'living-matter' ? 'Prismatic' : 'Harmonic'}</span>{' '}<em>{form === 'living-matter' ? 'Nocturne' : 'Shell'}</em></h1>
      </section>
      <div className={styles.artworkNote} aria-hidden="true"><span className={styles.noteIndex}>{form === 'living-matter' ? '01 — 02' : '02 — 02'}</span><span className={styles.noteRule} /><span>{form === 'living-matter' ? 'LIVING MATTER' : 'HARMONIC SHELL'}</span></div>

      <section className={styles.player} aria-label="Local audio player" inert={focusMode}>
        <div className={styles.trackLine}>
          <div className={styles.trackIdentity}>
            <span className={`${styles.statusDot} ${playing ? styles.isPlaying : ''}`} aria-hidden="true" />
            <span className={styles.trackText} title={track || 'Choose a track to begin'}>{preparation === 'analyzing' ? `Listening for the pulse · ${preparationProgress}%` : track || 'Choose a track to begin'}</span>
          </div>
          <span className={styles.time}>{clock(progress)} <span>/</span> {clock(duration)}</span>
        </div>
        <input aria-label="Seek through track" className={styles.seek} type="range" min="0" step="0.1" max={duration || 1}
          disabled={!duration} value={Math.min(progress, duration || 0)}
          aria-valuetext={`${clock(progress)} of ${clock(duration)}`}
          onChange={(event) => seek(Number(event.target.value))}
          style={{ '--progress': `${duration ? progress / duration * 100 : 0}%` } as CSSProperties} />
        <div className={styles.playerBottom}>
          <div className={styles.transport}>
            <button className={styles.playButton} type="button" disabled={loading || preparation === 'analyzing'} onClick={togglePlayback}
              aria-label={playing ? 'Pause audio' : track ? 'Play audio' : 'Choose a track'}><Icon name={playing ? 'pause' : 'play'} /></button>
            <button className={styles.uploadButton} type="button" onClick={() => fileInputRef.current?.click()}>{track ? 'Change track' : 'Add local audio'}<Icon name="arrow" /></button>
            {track && <details className={styles.trackMenu}><summary aria-label="Track options">Options <span aria-hidden="true">· · ·</span></summary><div><button type="button" onClick={removeTrack}>Remove track</button></div></details>}
            <input ref={fileInputRef} tabIndex={-1} aria-label="Choose an audio file" accept="audio/*" className={styles.fileInput} type="file"
              onChange={(event) => { void loadTrack(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </div>
        </div>
        <p className={styles.error} role="status" aria-live="polite">{error}</p>
      </section>
      <footer className={styles.footer}><span>YOUR MUSIC STAYS ON YOUR DEVICE</span></footer>
      {focusMode && <button ref={focusExitRef} className={styles.focusExit} type="button" onClick={toggleFullscreen} aria-label="Exit focus mode"><Icon name="close" /></button>}
      {focusMode && <div className={styles.focusTransport}>
        <button type="button" onClick={togglePlayback} disabled={loading || preparation === 'analyzing'} aria-label={playing ? 'Pause audio' : 'Play audio'}><Icon name={playing ? 'pause' : 'play'} /></button>
        <span>{track || 'Add a track to begin'}</span>
      </div>}
      {dragging && <div className={styles.dropOverlay}>Let your music in.<span>Drop an audio file</span></div>}
    </main>
  );
}
