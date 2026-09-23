import styles from '@/app/home.module.css';

export function GalleryJourney() {
  return <section className={styles.journey} aria-labelledby="becoming-heading">
    <div className={styles.sectionTop}><span>02 / Becoming</span><span>From sound to form</span></div>
    <div className={styles.journeyStory}>
      <div className={`${styles.storyChapter} ${styles.storyRest}`} data-gallery-chapter="rest">
        <div className={styles.storyInner}>
          <h2 id="becoming-heading">One form.<br /><em>Infinite feeling.</em></h2>
          <span className={styles.storyIndex}>01 / Rest</span>
          <h3>Rest</h3>
          <p>A quiet presence, waiting for sound.</p>
        </div>
      </div>
      <div className={styles.storyChapter} data-gallery-chapter="flow">
        <div className={styles.storyInner}>
          <span className={styles.storyIndex}>02 / Flow</span>
          <h3>Flow</h3>
          <p>Surface and silhouette begin to breathe.</p>
        </div>
      </div>
      <div className={styles.storyChapter} data-gallery-chapter="charge">
        <div className={styles.storyInner}>
          <span className={styles.storyIndex}>03 / Charge</span>
          <h3>Charge</h3>
          <p>Light gathers where the music strikes.</p>
        </div>
      </div>
      <div className={`${styles.storyChapter} ${styles.storyHandoff}`} data-gallery-chapter="shell">
        <div className={styles.storyInner}>
          <span className={styles.storyIndex}>04 / Material study</span>
          <h3>Structure,<br /><em>revealed.</em></h3>
          <p>The soft body remains. A quieter structure begins to surface within it.</p>
        </div>
      </div>
    </div>
  </section>;
}
