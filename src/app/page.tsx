'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSheet } from '@/lib/api';
import styles from './page.module.css';

const TTL_CHOICES = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttl, setTtl] = useState(14);

  async function onCreate() {
    setLoading(true);
    setError(null);
    try {
      const { id } = await createSheet({ ttlDays: ttl });
      router.push(`/s/${id}`);
    } catch (e: any) {
      setError(e.message ?? 'failed');
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <span className={styles.mark}>OpenSheets<span className={styles.dot} /></span>
        <span className={styles.topRight}>EST. 2025 · No. 001</span>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>Ephemeral spreadsheets</span>
          <h1 className={styles.headline}>
            <span>A clean</span>
            <span><em>sheet</em>.</span>
            <span>Then gone.</span>
          </h1>
          <p className={styles.lede}>
            Free, open-source, real-time spreadsheets that <strong>auto-delete</strong> when
            you&rsquo;re done. No accounts. No baggage. Share a link &mdash; collaborate &mdash; move on.
          </p>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.gridArt} aria-hidden="true">
            <svg viewBox="0 0 480 520" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="cells" x="0" y="0" width="80" height="60" patternUnits="userSpaceOnUse">
                  <rect width="80" height="60" fill="none" stroke="rgba(21,17,12,0.18)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect x="20" y="20" width="440" height="480" fill="var(--paper-2)" stroke="var(--rule)" strokeWidth="1.5" />
              <rect x="20" y="20" width="440" height="480" fill="url(#cells)" />
              <rect x="20" y="20" width="440" height="36" fill="var(--ink)" />
              <text x="40" y="44" fontFamily="JetBrains Mono, monospace" fontSize="12" fill="var(--paper)" letterSpacing="2">A1 · UNTITLED</text>
              <rect x="100" y="80" width="160" height="60" fill="var(--accent)" opacity="0.92" />
              <rect x="180" y="200" width="80" height="60" fill="var(--ink)" />
              <rect x="260" y="200" width="80" height="60" fill="var(--accent-2)" opacity="0.85" />
              <rect x="100" y="380" width="240" height="60" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 4" />
              <text x="40" y="180" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="44" fill="var(--ink)">Q3</text>
              <text x="40" y="320" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="44" fill="var(--ink-2)">Q4</text>
              <text x="290" y="240" fontFamily="JetBrains Mono, monospace" fontSize="14" fill="var(--paper)">+24%</text>
            </svg>
          </div>
        </div>
      </section>

      <div className={styles.tickerStrip} aria-hidden="true">
        <div className={styles.ticker}>
          <span>No sign-up</span>
          <span>Real-time presence</span>
          <span>Open source</span>
          <span>Donation-funded</span>
          <span>Self-destructs</span>
          <span>No sign-up</span>
          <span>Real-time presence</span>
          <span>Open source</span>
          <span>Donation-funded</span>
          <span>Self-destructs</span>
        </div>
      </div>

      <section className={styles.hero} style={{ alignItems: 'start' }}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>Spin one up</span>
          <h2 className={styles.headline} style={{ fontSize: 'clamp(36px, 6vw, 68px)' }}>
            <span>Pick a <em>shelf life</em>.</span>
            <span>Get to work.</span>
          </h2>
          <p className={styles.footnote}>
            The sheet quietly disappears after the chosen window of inactivity.
            You can always come back to extend it.
          </p>
        </div>

        <form
          className={styles.card}
          onSubmit={(e) => { e.preventDefault(); onCreate(); }}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardLabel}>New sheet</span>
            <span className={styles.cardIndex}>FORM / 01</span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Auto-delete after</span>
            <div className={styles.ttlGroup} role="group" aria-label="Sheet lifespan">
              {TTL_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className={styles.ttlOption}
                  aria-pressed={ttl === choice.value}
                  onClick={() => setTtl(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className={styles.create}
            disabled={loading}
          >
            <span>{loading ? 'Creating sheet…' : 'Create new sheet'}</span>
            <span className={styles.createArrow}>→</span>
          </button>

          {error && <p className={styles.error}>Error: {error}</p>}
        </form>
      </section>

      <footer className={styles.feet}>
        <span>© OpenSheets — runs on goodwill</span>
        <span>
          <a href="https://opencollective.com/">Donate</a>
          {' · '}
          <a href="https://github.com/">Source</a>
        </span>
      </footer>
    </main>
  );
}
