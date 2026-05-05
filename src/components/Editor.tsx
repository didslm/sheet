'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sheet, PARTY_HOST, updateSheetTitle } from '@/lib/api';
import type { ActivitySummary, PresenceSummary } from './UniverSheet';
import styles from './Editor.module.css';
import {
  TableCellsIcon,
  ClockIcon,
  LinkIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  PencilIcon,
} from './icons';

const UniverSheet = dynamic(() => import('./UniverSheet'), { ssr: false });

export default function Editor({ sheet }: { sheet: Sheet }) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState(sheet.title);
  const [titleDraft, setTitleDraft] = useState(sheet.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceSummary>({ activeCount: 0, editingCells: [] });
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const expiresIn = Math.max(0, Math.ceil((new Date(sheet.expires_at).getTime() - Date.now()) / 86_400_000));
  const hasEditingPresence = presence.editingCells.length > 0;

  useEffect(() => {
    setSheetTitle(sheet.title);
    setTitleDraft(sheet.title);
  }, [sheet.title]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
      setActivities((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: 'Sheet renamed',
          detail: title,
          actor: 'You',
          createdAt: Date.now(),
        },
        ...current,
      ].slice(0, 8));
    } catch (error) {
      setTitleDraft(sheetTitle);
      setTitleError('Could not rename sheet');
    } finally {
      setTitleSaving(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <a href="/" className={styles.brand} aria-label="OpenSheets home">
            <TableCellsIcon width={20} height={20} stroke="#fff" strokeWidth={1.8} />
          </a>

          <div className={styles.titleColumn}>
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
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setTitleDraft(sheetTitle);
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Sheet title"
                disabled={titleSaving}
                spellCheck={false}
                placeholder="Untitled spreadsheet"
              />
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
              aria-label="Toggle activity history"
              title="Activity"
            >
              <ClockIcon />
              <span className={`${styles.iconLabel} ${styles.hideMobile}`}>Activity</span>
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              className={`${styles.iconButton} ${styles.shareButton} ${copied ? styles.copied : ''}`}
              title="Copy share link"
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
              <span className={styles.iconLabel}>{copied ? 'Copied' : 'Share'}</span>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setMenuOpen(true)}
              aria-label="More options"
              title="More"
            >
              <EllipsisVerticalIcon />
            </button>
          </div>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <span className={styles.livePulse} aria-hidden="true" />
            <span className={styles.metaValue}>{presence.activeCount}</span>
            <span className={styles.metaLabel}>online</span>
          </span>

          {hasEditingPresence && (
            <span className={styles.presenceRail}>
              <span className={styles.presenceScroller}>
                {presence.editingCells.map((entry) => (
                  <span key={entry.clientId} className={styles.presencePill}>
                    <span className={styles.presenceDot} style={{ background: entry.color }} />
                    <span>{entry.name}{entry.isLocal ? ' (you)' : ''} · {entry.label}</span>
                  </span>
                ))}
              </span>
            </span>
          )}

          <span className={styles.metaItem} style={{ marginLeft: 'auto' }}>
            <span className={styles.metaLabel}>Auto-deletes in</span>
            <span className={styles.metaValue}>{expiresIn}d</span>
          </span>
        </div>

        {titleError && <div className={styles.titleError}>{titleError}</div>}
      </header>

      <div className={styles.workspace}>
        <div className={styles.editorFrame}>
          <UniverSheet
            sheetId={sheet.id}
            partyHost={PARTY_HOST}
            onPresenceChange={setPresence}
            onActivityChange={(entry) => setActivities((current) => [entry, ...current].slice(0, 8))}
          />
        </div>

        <aside className={`${styles.historySidebar} ${historyOpen ? styles.historySidebarOpen : ''}`}>
          <div className={styles.historyHeader}>
            <div>
              <div className={styles.historyEyebrow}>Activity</div>
              <div className={styles.historyTitle}>Recent changes</div>
            </div>
            <button
              type="button"
              className={styles.historyClose}
              onClick={() => setHistoryOpen(false)}
              aria-label="Close activity panel"
            >
              <XMarkIcon />
            </button>
          </div>
          <div className={styles.historyList}>
            {activities.length === 0 ? (
              <p className={styles.historyEmpty}>Edits will appear here as the sheet changes.</p>
            ) : (
              activities.map((entry) => (
                <article key={entry.id} className={styles.historyItem}>
                  <div className={styles.historyItemTop}>
                    <span className={styles.historyActor}>{entry.actor}</span>
                    <span className={styles.historyTime}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <div className={styles.historyItemLabel}>{entry.label}</div>
                  <div className={styles.historyItemDetail}>{entry.detail}</div>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>

      <div
        className={`${styles.scrim} ${menuOpen ? styles.scrimOpen : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`${styles.sheet} ${menuOpen ? styles.sheetOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Sheet details"
      >
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHead}>
          <span className={styles.sheetTitle}>Spreadsheet details</span>
          <button type="button" className={styles.sheetClose} onClick={() => setMenuOpen(false)}>Done</button>
        </div>

        <div className={styles.sheetMeta}>
          <div className={styles.sheetMetaRow}>
            <span className={styles.sheetMetaLabel}>People online</span>
            <span className={styles.sheetMetaValue}>
              <span className={styles.livePulse} aria-hidden="true" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
              {presence.activeCount}
            </span>
          </div>
          <div className={styles.sheetMetaRow}>
            <span className={styles.sheetMetaLabel}>Auto-deletes in</span>
            <span className={styles.sheetMetaValue}>{expiresIn} day(s)</span>
          </div>
          <div className={styles.sheetMetaRow}>
            <span className={styles.sheetMetaLabel}>Sheet ID</span>
            <span className={styles.sheetMetaValue} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>{sheet.id}</span>
          </div>
        </div>

        {hasEditingPresence && (
          <div className={styles.sheetPresenceList}>
            {presence.editingCells.map((entry) => (
              <span key={entry.clientId} className={styles.presencePill}>
                <span className={styles.presenceDot} style={{ background: entry.color }} />
                <span>{entry.name}{entry.isLocal ? ' (you)' : ''} · {entry.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className={styles.sheetActions}>
          <button
            type="button"
            className={`${styles.sheetButton} ${styles.sheetButtonPrimary} ${copied ? styles.copied : ''}`}
            onClick={copyShareLink}
          >
            <span>{copied ? 'Link copied' : 'Copy share link'}</span>
            {copied ? <CheckIcon width={20} height={20} /> : <LinkIcon width={20} height={20} />}
          </button>
          <button
            type="button"
            className={styles.sheetButton}
            onClick={() => { setMenuOpen(false); setHistoryOpen((open) => !open); }}
          >
            <span>{historyOpen ? 'Hide activity' : 'Show activity'}</span>
            <ClockIcon width={20} height={20} />
          </button>
          <button
            type="button"
            className={styles.sheetButton}
            onClick={() => { setMenuOpen(false); setTimeout(() => titleInputRef.current?.focus(), 100); }}
          >
            <span>Rename spreadsheet</span>
            <PencilIcon width={20} height={20} />
          </button>
        </div>

        <div className={styles.sheetActivity}>
          <span className={styles.sheetMetaLabel}>Recent activity</span>
          {activities.length === 0 ? (
            <p className={styles.activityEmpty}>Nothing yet — edits will show up here.</p>
          ) : (
            activities.slice(0, 4).map((entry) => (
              <article key={entry.id} className={styles.historyItem}>
                <div className={styles.historyItemTop}>
                  <span className={styles.historyActor}>{entry.actor}</span>
                  <span className={styles.historyTime}>{new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className={styles.historyItemLabel}>{entry.label}</div>
                <div className={styles.historyItemDetail}>{entry.detail}</div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
