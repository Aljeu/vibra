import type { Metadata } from 'next';
import PrototypeClient from './prototype-client';

export const metadata: Metadata = {
  title: 'Prismatic Nocturne — Vibra prototype',
  description: 'An experimental, audio-reactive sculpture for Vibra.',
};

export default function PrototypePage() {
  return <PrototypeClient />;
}
