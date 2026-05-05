'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sheet, PARTY_HOST } from '@/lib/api';

const UniverSheet = dynamic(() => import('./UniverSheet'), { ssr: false });

export default function Editor({ sheet }: { sheet: Sheet }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const expiresIn = Math.max(0, Math.ceil((new Date(sheet.expires_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid #e5e5e5', background: '#fff' }}>
        <a href="/" style={{ fontWeight: 600, textDecoration: 'none', color: '#111' }}>OpenSheets</a>
        <span style={{ color: '#666' }}>{sheet.title}</span>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 13 }}>Expires in {expiresIn} day(s)</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fafafa' }}
        >
          {copied ? 'Copied!' : 'Copy share link'}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <UniverSheet sheetId={sheet.id} partyHost={PARTY_HOST} />
      </div>
    </div>
  );
}
