'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSheet } from '@/lib/api';
import styles from './page.module.css';

const REPO_URL = 'https://github.com/didslm/sheet';

const TTL_CHOICES = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
];

const DONATE_AMOUNTS = [3, 5, 10, 25];

function formatExpiry(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttl, setTtl] = useState(14);

  const expiry = useMemo(() => formatExpiry(ttl), [ttl]);

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
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <span className={styles.logo} aria-hidden="true">
            <img src="/logo.png" alt="" />
          </span>
          <span className={styles.brand}>OpenSheets</span>
        </div>
        <nav className={styles.topRight}>
          <a className={styles.topLink} href="https://paypal.me/diarslm" target="_blank" rel="noopener noreferrer">Donate</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>Free, public, no account</span>
          <h1 className={styles.headline}>Create a collaborative spreadsheet and share it instantly.</h1>
          <p className={styles.lede}>
            OpenSheets is a simple temporary spreadsheet for quick collaboration. Open one,
            send the link, edit together, and let it disappear on its own when its time is up.
          </p>

          <div className={styles.highlights}>
            <div className={styles.highlight}>
              <p className={styles.highlightTitle}>Fast</p>
              <p className={styles.highlightText}>Start a sheet in one click and send the link immediately.</p>
            </div>
            <div className={styles.highlight}>
              <p className={styles.highlightTitle}>Shared</p>
              <p className={styles.highlightText}>Everyone with the link can edit in real time.</p>
            </div>
            <div className={styles.highlight}>
              <p className={styles.highlightTitle}>Temporary</p>
              <p className={styles.highlightText}>Choose the sheet lifetime up front and let it clean itself up.</p>
            </div>
          </div>
        </div>

        <form
          className={styles.createCard}
          onSubmit={(e) => { e.preventDefault(); onCreate(); }}
          aria-label="Create a spreadsheet"
        >
          <div className={styles.cardHead}>
            <span className={styles.cardEyebrow}>New sheet</span>
            <h2 className={styles.cardTitle}>Create a spreadsheet</h2>
            <p className={styles.cardSub}>
              Pick how long it should live, then open it and start collaborating.
            </p>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Lifespan</span>
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

          <div className={styles.meta}>
            <div>
              <span className={styles.metaLabel}>Expires on</span>
              <span className={styles.metaValue}>{expiry}</span>
            </div>
            <div className={styles.metaNote}>This sheet will be removed automatically after the selected lifetime.</div>
          </div>

          <div className={styles.cardActions}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Creating…' : 'Create spreadsheet'}
            </button>
          </div>

          {error && <p className={styles.error}>Error: {error}</p>}
        </form>
      </section>

      <section className={styles.support}>
        <div className={styles.supportCopy}>
          <h2 className={styles.supportTitle}>Open source and donation funded.</h2>
          <p className={styles.supportBody}>
            OpenSheets is free, open source, and ad-free on purpose. Hosting and
            storage cost real money each month. If the tool was useful to you,
            chip in what you can — that&rsquo;s how it stays free for the next person.
          </p>
        </div>
        <div className={styles.supportActions} role="group" aria-label="Donation amount">
            {DONATE_AMOUNTS.map((amt) => (
              <a
                key={amt}
                className={styles.donateAmount}
                href={`https://paypal.me/diarslm/${amt}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                €{amt}
              </a>
            ))}
          <a
            className={styles.donatePrimary}
            href="https://paypal.me/diarslm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate via PayPal
          </a>
        </div>
      </section>

      <footer className={styles.feet}>
        <span>© OpenSheets</span>
        <div className={styles.footLinks}>
          <a href="https://paypal.me/diarslm" target="_blank" rel="noopener noreferrer">Donate</a>
        </div>
      </footer>
    </main>
  );
}
