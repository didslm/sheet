'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sheet, PARTY_HOST, updateSheetTitle } from '@/lib/api';
import type { PresenceSummary } from './UniverSheet';
import styles from './Editor.module.css';

const UniverSheet = dynamic(() => import('./UniverSheet'), { ssr: false });

export default function Editor({ sheet }: { sheet: Sheet }) {
  const [copied, setCopied] = useState(false);
  const [mobileMetaOpen, setMobileMetaOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState(sheet.title);
  const [titleDraft, setTitleDraft] = useState(sheet.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceSummary>({ activeCount: 0, editingCells: [] });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const expiresIn = Math.max(0, Math.ceil((new Date(sheet.expires_at).getTime() - Date.now()) / 86_400_000));
  const hasEditingPresence = presence.editingCells.length > 0;

  useEffect(() => {
    setSheetTitle(sheet.title);
    setTitleDraft(sheet.title);
  }, [sheet.title]);

  async function commitTitle(nextTitle?: string) {
    const normalized = (nextTitle ?? titleDraft).trim();
    if (!normalized || normalized === sheetTitle) {
      setTitleDraft(sheetTitle);
      return;
    }

    setTitleSaving(true);
    setTitleError(null);
    try {
      const { title } = await updateSheetTitle(sheet.id, normalized);
      setSheetTitle(title);
      setTitleDraft(title);
    } catch (error) {
      setTitleDraft(sheetTitle);
      setTitleError('Could not rename sheet');
    } finally {
      setTitleSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.brandLockup}>
            <a href="/" className={styles.brand}>OpenSheets</a>
            <div className={styles.titleWrap}>
              <input
                ref={titleInputRef}
                className={styles.titleInput}
                value={titleDraft}
                onChange={(event) => {
                  setTitleDraft(event.target.value);
                  setTitleError(null);
                }}
                onBlur={() => { void commitTitle(); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    setTitleDraft(sheetTitle);
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Sheet title"
                disabled={titleSaving}
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.renameButton}
                onClick={() => titleInputRef.current?.focus()}
              >
                Rename
              </button>
            </div>
          </div>
          <div className={styles.mobileActions}>
            <span className={styles.mobileStatus}>
              {presence.activeCount} active
            </span>
            <button
              onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className={`${styles.copyButton} ${styles.mobileCopyButton}`}
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              type="button"
              className={styles.detailsButton}
              aria-expanded={mobileMetaOpen}
              onClick={() => setMobileMetaOpen((open) => !open)}
            >
              {mobileMetaOpen ? 'Hide details' : 'Show details'}
            </button>
          </div>
        </div>
        <div className={`${styles.meta} ${mobileMetaOpen ? styles.metaOpen : ''}`}>
          <span className={styles.muted}>
            {presence.activeCount} active
          </span>
          {hasEditingPresence && (
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
            className={`${styles.copyButton} ${styles.desktopCopyButton}`}
          >
            {copied ? 'Copied!' : 'Copy share link'}
          </button>
        </div>
        {titleError && <div className={styles.titleError}>{titleError}</div>}
      </header>
      <div className={styles.editorFrame}>
        <UniverSheet sheetId={sheet.id} partyHost={PARTY_HOST} onPresenceChange={setPresence} />
      </div>
    </div>
  );
}
