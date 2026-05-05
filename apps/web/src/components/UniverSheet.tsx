'use client';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Univer + Yjs binding
//
// MVP approach: render Univer, connect a Yjs doc to the server via y-websocket so the
// underlying CRDT doc + persistence + presence pipeline is already wired. Cell-level
// binding (turning every Univer mutation into a Y.Map op and vice versa) is the next
// step — see ROADMAP. For now the doc syncs but Univer's local state is not yet
// reflected into Y, so changes are visible only locally until the binding lands.
//
// To implement the binding:
//   1. Subscribe to Univer's command service (onCommandExecuted) for SET_RANGE_VALUES etc.
//   2. Mirror cells into a Y.Map keyed by `${sheetId}!${row},${col}`.
//   3. Observe the Y.Map and dispatch reverse commands when remote updates arrive.
//   4. Use a transaction origin tag to prevent loops.

export default function UniverSheet({ sheetId, wsUrl }: { sheetId: string; wsUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      const { createUniver, LocaleType, merge } = await import('@univerjs/presets');
      const { UniverSheetsCorePreset } = await import('@univerjs/presets/preset-sheets-core');
      const sheetsCoreEnUS = (await import('@univerjs/presets/preset-sheets-core/locales/en-US')).default;
      await import('@univerjs/presets/lib/styles/preset-sheets-core.css');

      if (disposed || !containerRef.current) return;

      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: merge({}, sheetsCoreEnUS) },
        presets: [UniverSheetsCorePreset({ container: containerRef.current })],
      });

      univerAPI.createWorkbook({ name: 'Sheet' });

      const ydoc = new Y.Doc();
      const provider = new WebsocketProvider(wsUrl, sheetId, ydoc);

      // TODO: bind univerAPI <-> ydoc (see comment at top)

      cleanupRef.current = () => {
        provider.destroy();
        ydoc.destroy();
        // univerAPI dispose: Univer presets currently has no top-level dispose; remount handles cleanup.
      };
    })();

    return () => {
      disposed = true;
      cleanupRef.current();
    };
  }, [sheetId, wsUrl]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
