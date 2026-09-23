import type { Metadata } from 'next';
import VibraExperience from '@/components/vibra-experience';

export const metadata: Metadata = {
  title: 'Studio — Vibra',
  description: 'Enter the Vibra studio. Your music becomes a living, pearlescent sculpture.',
};

export default function StudioPage() {
  return <VibraExperience />;
}
