'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sheet, PARTY_HOST } from '@/lib/api';
import type { PresenceSummary } from './UniverSheet';
import styles from './Editor.module.css';

const UniverSheet = dynamic(() => import('./UniverSheet'), { ssr: false });

export default function Editor({ sheet }: { sheet: Sheet }) {
  const [copied, setCopied] = useState(false);
  const [presence, setPresence] = useState<PresenceSummary>({ activeCount: 0, editingCells: [] });
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const expiresIn = Math.max(0, Math.ceil((new Date(sheet.expires_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>OpenSheets</a>
        <span className={styles.title}>{sheet.title}</span>
        <div className={styles.meta}>
          <span className={styles.muted}>
            {presence.activeCount} active
          </span>
          {presence.editingCells.length > 0 && (
            <div className={styles.presenceRail}>
              <div className={styles.presenceScroller}>
              {presence.editingCells.map((entry) => (
                <span
                  key={entry.clientId}
                  className={styles.presencePill}
                >
                  <span className={styles.presenceDot} style={{ background: entry.color }} />
                  <span>{entry.name}{entry.isLocal ? ' (you)' : ''}: {entry.label}</span>
                </span>
              ))}
              </div>
            </div>
          )}
          <span className={styles.muted}>Expires in {expiresIn} day(s)</span>
          <button
            onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className={styles.copyButton}
          >
            {copied ? 'Copied!' : 'Copy share link'}
          </button>
        </div>
      </header>
      <div className={styles.editorFrame}>
        <UniverSheet sheetId={sheet.id} partyHost={PARTY_HOST} onPresenceChange={setPresence} />
      </div>
    </div>
  );
}
