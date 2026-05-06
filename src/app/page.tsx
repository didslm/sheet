'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSheet } from '@/lib/api';
import styles from './page.module.css';
import { TableCellsIcon, ArrowRightIcon } from '@/components/icons';

const TTL_CHOICES = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
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
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <span className={styles.logo} aria-hidden="true">
            <TableCellsIcon width={20} height={20} stroke="#fff" strokeWidth={1.8} />
          </span>
          <span className={styles.brand}>OpenSheets</span>
        </div>
        <nav className={styles.topRight}>
          <a className={styles.topLink} href="https://github.com/">GitHub</a>
          <a className={styles.topLink} href="https://opencollective.com/">Donate</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>Free · Open source · No account</span>
        <h1 className={styles.headline}>Spreadsheets that quietly disappear.</h1>
        <p className={styles.lede}>
          Create a collaborative spreadsheet in one click, share the link, work together in real time.
          The sheet auto-deletes after the window of inactivity you choose.
        </p>

        <form
          className={styles.dialog}
          onSubmit={(e) => { e.preventDefault(); onCreate(); }}
        >
          <h2 className={styles.dialogTitle}>Create a new spreadsheet</h2>
          <p className={styles.dialogSub}>Pick how long the sheet should stick around without activity.</p>

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

          <div className={styles.dialogActions}>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Creating…' : 'Create spreadsheet'}
            </button>
          </div>

          {error && <p className={styles.error}>Error: {error}</p>}
        </form>
      </section>

      <footer className={styles.feet}>
        <span>© OpenSheets — runs on donations</span>
        <a href="https://opencollective.com/">Donate</a>
        <a href="https://github.com/">Source</a>
      </footer>
    </main>
  );
}
