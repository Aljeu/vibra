import { preludePath, type PreludeState } from './prelude-shape';
import styles from '@/app/home.module.css';

type Props = {
  idPrefix: string;
  state?: PreludeState;
  animate?: boolean;
  className?: string;
};

export function PreludeArt({ idPrefix, state = 'rest', animate = false, className = '' }: Props) {
  const bodyId = `${idPrefix}-body`;
  const lightId = `${idPrefix}-light`;
  const rimId = `${idPrefix}-rim`;
  const shapeId = `${idPrefix}-shape`;
  const blurId = `${idPrefix}-blur`;
  const shape = preludePath(state);

  return <div className={`${styles.prelude} ${className}`} data-animate={animate} aria-hidden="true">
    <svg viewBox="0 0 680 680" role="presentation" focusable="false">
      <defs>
        <radialGradient id={bodyId} cx="37%" cy="27%" r="78%">
          <stop offset="0" stopColor="#f8efe9" />
          <stop offset=".21" stopColor="#cbd8d5" />
          <stop offset=".51" stopColor="#7d9297" />
          <stop offset=".77" stopColor="#534662" />
          <stop offset="1" stopColor="#211728" />
        </radialGradient>
        <radialGradient id={lightId} cx="48%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ead6dc" stopOpacity=".83" />
          <stop offset=".47" stopColor="#b7a0be" stopOpacity=".32" />
          <stop offset="1" stopColor="#b7a0be" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e2e5db" stopOpacity=".8" />
          <stop offset=".35" stopColor="#b1c7c4" stopOpacity=".28" />
          <stop offset=".75" stopColor="#a58ab3" stopOpacity=".4" />
          <stop offset="1" stopColor="#2b1c37" stopOpacity=".15" />
        </linearGradient>
        <clipPath id={shapeId}><path data-prelude-clip d={shape} /></clipPath>
        <filter id={blurId}><feGaussianBlur stdDeviation="17" /></filter>
      </defs>
      <ellipse className={styles.artShadow} cx="343" cy="578" rx="191" ry="34" fill="#050309" opacity=".32" filter={`url(#${blurId})`} />
      <g className={styles.artBody}>
        <path data-prelude-body d={shape} fill={`url(#${bodyId})`} stroke={`url(#${rimId})`} strokeWidth="2" />
        <g clipPath={`url(#${shapeId})`}>
          <ellipse cx="217" cy="216" rx="187" ry="107" transform="rotate(-35 217 216)" fill="#f5f1ea" opacity=".29" filter={`url(#${blurId})`} />
          <ellipse cx="484" cy="473" rx="185" ry="211" fill="#684b83" opacity=".26" filter={`url(#${blurId})`} />
          <g data-prelude-light className={styles.artLightPosition}>
            <g className={styles.artLightDrift}><ellipse cx="431" cy="177" rx="147" ry="67" transform="rotate(38 431 177)" fill={`url(#${lightId})`} /></g>
          </g>
          <path d="M76 396c155-80 285-47 494-174M89 431c164-95 293-57 489-171M99 465c182-88 332-71 500-183" fill="none" stroke="#e7e5e2" strokeOpacity=".12" strokeWidth="3" />
          <path d="M143 197c95-69 179-83 291-27" fill="none" stroke="#f8f4e9" strokeOpacity=".25" strokeWidth="8" filter={`url(#${blurId})`} />
          <path className={styles.artShellLines} d="M144 279c107-36 257-6 410-76M124 331c136-20 290-10 447-66M117 385c158-8 303-17 470-78M131 441c163 6 301-21 452-83" fill="none" stroke="#e1e4e0" strokeWidth="1.4" />
        </g>
        <path data-prelude-shell className={styles.artShellEdge} d={shape} fill="none" stroke="#d6d8d5" strokeWidth="1.6" />
      </g>
    </svg>
  </div>;
}
