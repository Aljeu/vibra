'use client';

import Link from 'next/link';
import { useVibraSession } from '@/components/vibra-session-provider';
import styles from '@/app/home.module.css';

export function HomeSessionStatus() {
  const { track, progress } = useVibraSession();
  if (!track) return null;
  const time = `${Math.floor(progress / 60)}:${Math.floor(progress % 60).toString().padStart(2, '0')}`;
  return <div className={styles.sessionStatus} role="status">
    <span className={styles.sessionDot} aria-hidden="true" />
    <span className={styles.sessionText}><strong>{track}</strong><small>Paused at {time}</small></span>
    <Link href="/studio" prefetch={false}>Return to studio <span aria-hidden="true">↗</span></Link>
  </div>;
}
