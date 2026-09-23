import type { Metadata } from 'next';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-ext-400.css';
import '@fontsource/dm-mono/latin-400.css';
import './globals.css';
import { VibraSessionProvider } from '@/components/vibra-session-provider';
export const metadata: Metadata = { title: 'Vibra — See music take shape', description: 'A browser-based instrument for seeing music take shape. Your audio stays on your device.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><VibraSessionProvider>{children}</VibraSessionProvider></body></html>; }
