'use client';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

// Univer + Yjs binding
//
// MVP approach: render Univer, connect a Yjs doc to PartyKit. The CRDT doc + persistence
// + presence pipeline is wired (PartyKit persists the doc in Durable Object storage).
// Cell-level binding (Univer mutations <-> Y.Map ops) is the next step:
//   1. Subscribe to Univer's command service (onCommandExecuted) for SET_RANGE_VALUES.
//   2. Mirror cells into a Y.Map keyed by `${sheetId}!${row},${col}`.
//   3. Observe the Y.Map and dispatch reverse commands on remote updates.
//   4. Use a transaction origin tag to prevent echo loops.

export default function UniverSheet({ sheetId, partyHost }: { sheetId: string; partyHost: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      const { createUniver, LocaleType, merge, defaultTheme } = await import('@univerjs/presets');
      const { UniverSheetsCorePreset } = await import('@univerjs/presets/preset-sheets-core');
      const sheetsCoreEnUS = (await import('@univerjs/presets/preset-sheets-core/locales/en-US')).default;

      if (disposed || !containerRef.current) return;

      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: merge({}, sheetsCoreEnUS) },
        theme: defaultTheme,
        presets: [UniverSheetsCorePreset({ container: containerRef.current })],
      });

      univerAPI.createWorkbook({ name: 'Sheet' });

      const ydoc = new Y.Doc();
      const provider = new YPartyKitProvider(partyHost, sheetId, ydoc);

      // TODO: bind univerAPI <-> ydoc (see comment at top)

      cleanupRef.current = () => {
        provider.destroy();
        ydoc.destroy();
      };
    })();

    return () => {
      disposed = true;
      cleanupRef.current();
    };
  }, [sheetId, partyHost]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
