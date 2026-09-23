'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '@/lib/audio-engine';
import { analyzeTrack } from '@/lib/audio/track-analysis';

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const volumeRef = useRef(0.8);
  const [track, setTrack] = useState('');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState('');
  const [preparation, setPreparation] = useState<'idle' | 'analyzing' | 'ready' | 'fallback'>('idle');
  const [preparationProgress, setPreparationProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      requestRef.current += 1;
      analysisAbortRef.current?.abort();
      engineRef.current?.dispose();
      engineRef.current = null;
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  const loadTrack = useCallback(async (file?: File) => {
    const audio = audioRef.current;
    if (!file || !audio) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac|aiff|webm|mp4)$/i.test(file.name)) {
      setError('Please choose an audio file such as MP3, WAV, or M4A.');
      return;
    }
    const request = ++requestRef.current;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    audio.pause();
    setLoading(true); setError(''); setProgress(0); setDuration(0); setPreparation('analyzing'); setPreparationProgress(0);
    const previousUrl = objectUrlRef.current;
    objectUrlRef.current = URL.createObjectURL(file);
    audio.src = objectUrlRef.current;
    audio.load();
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    setTrack(file.name.replace(/\.[^.]+$/, ''));
    try {
      const engine = engineRef.current ?? (engineRef.current = new AudioEngine());
      engine.connect(audio); engine.reset(); engine.setTrackAnalysis(null); engine.setVolume(volumeRef.current);
      const analysis = await analyzeTrack(file, {
        signal: controller.signal,
        onProgress: (value) => {
          if (request === requestRef.current) setPreparationProgress((current) => value > current ? value : current);
        },
      });
      if (request !== requestRef.current) return;
      engine.setTrackAnalysis(analysis);
      setPreparation(analysis.confidence >= 0.55 ? 'ready' : 'fallback');
    } catch (failure) {
      if (request === requestRef.current) {
        setPlaying(false);
        if (failure instanceof DOMException && failure.name === 'AbortError') return;
        engineRef.current?.setTrackAnalysis(null);
        setPreparation('fallback');
      }
    } finally {
      if (request === requestRef.current) { setLoading(false); analysisAbortRef.current = null; }
    }
  }, []);

  const removeTrack = useCallback(() => {
    requestRef.current += 1;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    engineRef.current?.setTrackAnalysis(null);
    engineRef.current?.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTrack(''); setPlaying(false); setLoading(false); setProgress(0); setDuration(0);
    setPreparation('idle'); setPreparationProgress(0); setError('');
  }, []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.getAttribute('src')) { fileInputRef.current?.click(); return; }
    if (preparation === 'analyzing') return;
    setError('');
    if (!audio.paused) { audio.pause(); return; }
    const request = requestRef.current;
    try {
      await engineRef.current?.resume();
      if (request !== requestRef.current) return;
      await audio.play();
    } catch {
      if (request === requestRef.current) setError('Playback could not start. Try choosing the track again.');
    }
  }, [preparation]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const target = Math.max(0, Math.min(audio.duration, time));
    audio.currentTime = target; setProgress(target); engineRef.current?.reset();
  }, []);

  const setVolume = useCallback((value: number) => {
    volumeRef.current = value; setVolumeState(value); engineRef.current?.setVolume(value);
  }, []);

  return {
    audioRef, engineRef, fileInputRef, track, playing, loading, progress, duration, volume, error, preparation, preparationProgress,
    loadTrack, removeTrack, togglePlayback, seek, setVolume,
    audioEvents: {
      onPlay: () => setPlaying(true), onPause: () => setPlaying(false),
      onEnded: () => { setPlaying(false); setLoading(false); },
      onPlaying: () => setLoading(false),
      onTimeUpdate: () => setProgress(audioRef.current?.currentTime ?? 0),
      onDurationChange: () => {
        const value = audioRef.current?.duration;
        setDuration(value && Number.isFinite(value) ? value : 0);
      },
      onError: () => {
        setPlaying(false); setLoading(false);
        setError('This audio format could not be decoded. Please choose another file.');
      },
    },
  };
}
