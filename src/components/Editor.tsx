'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sheet, PARTY_HOST } from '@/lib/api';
import type { PresenceSummary } from './UniverSheet';

const UniverSheet = dynamic(() => import('./UniverSheet'), { ssr: false });

export default function Editor({ sheet }: { sheet: Sheet }) {
  const [copied, setCopied] = useState(false);
  const [presence, setPresence] = useState<PresenceSummary>({ activeCount: 0, editingCells: [] });
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const expiresIn = Math.max(0, Math.ceil((new Date(sheet.expires_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid #e5e5e5', background: '#fff', flexWrap: 'wrap' }}>
        <a href="/" style={{ fontWeight: 600, textDecoration: 'none', color: '#111' }}>OpenSheets</a>
        <span style={{ color: '#666' }}>{sheet.title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ color: '#666', fontSize: 13 }}>
            {presence.activeCount} active
          </span>
          {presence.editingCells.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {presence.editingCells.map((entry) => (
                <span
                  key={entry.clientId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    color: '#334155',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                  <span>{entry.name}{entry.isLocal ? ' (you)' : ''}: {entry.label}</span>
                </span>
              ))}
            </div>
          )}
          <span style={{ color: '#666', fontSize: 13 }}>Expires in {expiresIn} day(s)</span>
          <button
            onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fafafa' }}
          >
            {copied ? 'Copied!' : 'Copy share link'}
          </button>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <UniverSheet sheetId={sheet.id} partyHost={PARTY_HOST} onPresenceChange={setPresence} />
      </div>
    </div>
  );
}
