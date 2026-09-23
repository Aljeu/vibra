import Link from 'next/link';
import { HomeSessionStatus } from '@/components/home-session-status';
import { GalleryJourney } from '@/components/home/gallery-journey';
import { HeroArtwork } from '@/components/home/hero-artwork';
import { ExhibitionScroll } from '@/components/home/exhibition-scroll';
import styles from './home.module.css';

function StudioLink({ quiet = false }: { quiet?: boolean }) {
  return <Link href="/studio" prefetch={false} className={`${styles.studioLink} ${quiet ? styles.studioLinkQuiet : ''}`}>
    <span>Enter the studio</span><span aria-hidden="true">↗</span>
  </Link>;
}

export default function Home() {
  return <main className={styles.home} id="main">
    <header className={styles.header}>
      <a className={styles.wordmark} href="#main" aria-label="Vibra — top of page">vibra<span aria-hidden="true">✳</span></a>
      <span className={styles.headerIndex}>An instrument for seeing sound</span>
      <nav className={styles.headerActions} aria-label="Main navigation">
        <Link href="/studio" prefetch={false} className={styles.headerStudio}>Studio <span aria-hidden="true">↗</span></Link>
        <a href="#contact" className={styles.headerContact}>Contact <span aria-hidden="true">↓</span></a>
      </nav>
    </header>

    <div className={styles.exhibition} data-home-exhibition>
      <div className={styles.exhibitionStage} aria-hidden="true">
        <div className={styles.exhibitionArt}><HeroArtwork /></div>
      </div>
      <div className={styles.exhibitionContent}>
        <section className={styles.hero} data-gallery-chapter="arrival" aria-labelledby="hero-heading">
          <div className={styles.heroContent}>
            <span className={styles.kicker}>An audio-visual encounter</span>
            <h1 id="hero-heading" tabIndex={-1}><span className={styles.heroLine}><span>Give sound</span></span><span className={styles.heroLine}><em>a body.</em></span></h1>
            <p>Your music, transformed into a living form of light and movement.</p>
            <StudioLink />
          </div>
          <div className={styles.heroFoot}><span>Local audio · Made for listening</span><span>Scroll to discover <span aria-hidden="true">↓</span></span></div>
        </section>

        <section className={styles.proposition} data-gallery-chapter="idea" aria-labelledby="proposition-heading">
          <div className={styles.sectionTop}><span>01 / The idea</span><span>Listen differently</span></div>
          <div className={styles.propositionBody}>
            <p className={styles.marginNote}>What if music could occupy space?</p>
            <h2 id="proposition-heading">Not an image<br />of music.<br /><em>A presence.</em></h2>
            <p className={styles.propositionAside}>Rhythm becomes gesture. Energy becomes light. Every track finds a form of its own.</p>
          </div>
        </section>

        <GalleryJourney />

        <section className={styles.forms} data-gallery-chapter="forms" aria-labelledby="forms-heading">
          <div className={styles.sectionTop}><span>03 / Studies in listening</span><span>Two expressions, one world</span></div>
          <h2 id="forms-heading">A form for<br /><em>every feeling.</em></h2>
          <div className={styles.formGallery}>
            <div className={styles.formNotes}>
              <div><span>Study 01 / Soft body</span><h3>Living Matter</h3><p>A luminous, breathing sculpture that gives rhythm a physical presence.</p></div>
              <div><span>Study 02 / Structured body</span><h3>Harmonic Shell</h3><p>The same listening impulse, expressed through a more articulated surface.</p></div>
            </div>
          </div>
        </section>
      </div>
      <ExhibitionScroll />
    </div>

    <section className={styles.invitation} aria-labelledby="invitation-heading">
      <div className={styles.sectionTop}><span>04 / The threshold</span><span>Whenever you are ready</span></div>
      <div className={styles.invitationContent}>
        <span className={styles.kicker}>The rest is yours to hear</span>
        <h2 id="invitation-heading">Let it<br /><em>come alive.</em></h2>
        <StudioLink quiet />
        <p>Bring a track. Nothing leaves your device.</p>
      </div>
      <footer className={styles.footer} id="contact">
        <div className={styles.footerSignature}>
          <span className={styles.footerBrand}>vibra ✳</span>
          <span className={styles.footerCredit}>Sound, made visible by Aljhone Agnas.</span>
        </div>
        <span className={styles.footerMeta}>Local by design.</span>
        <nav className={styles.footerLinks} aria-label="Aljhone Agnas online">
          <a href="https://github.com/Aljeu" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
          <a href="https://www.linkedin.com/in/aljhoneagnas/" target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>
        </nav>
      </footer>
    </section>
    <HomeSessionStatus />
  </main>;
}
