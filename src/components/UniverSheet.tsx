'use client';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import type { ICellData, IDisposable } from '@univerjs/core';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

const CELL_KEY_PREFIX = 'cell:';
const LOCAL_SYNC_ORIGIN = 'opensheets-univer-sync';
const PRESENCE_STORAGE_KEY = 'opensheets-presence-user';
const PRESENCE_COLORS = ['#0f766e', '#1d4ed8', '#9333ea', '#c2410c', '#be123c', '#4f46e5'];

type PresenceUser = {
  name: string;
  color: string;
};

type EditingCell = {
  row: number;
  column: number;
};

type AwarenessPresenceState = {
  user?: PresenceUser;
  editing?: EditingCell | null;
};

export type PresenceSummary = {
  activeCount: number;
  editingCells: Array<{
    clientId: number;
    name: string;
    color: string;
    row: number;
    column: number;
    label: string;
    isLocal: boolean;
  }>;
};

type RemoteHighlight = {
  signature: string;
  disposable: IDisposable;
};

function columnToA1(column: number) {
  let value = column + 1;
  let label = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function toA1Label(row: number, column: number) {
  return `${columnToA1(column)}${row + 1}`;
}

function withAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

function getPresenceUser(clientId: number): PresenceUser {
  const color = PRESENCE_COLORS[Math.abs(clientId) % PRESENCE_COLORS.length];
  const fallback = { name: `Guest ${1000 + (Math.abs(clientId) % 9000)}`, color };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.sessionStorage.getItem(PRESENCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed?.name) return { name: parsed.name, color };
    }
  } catch {}

  const generated = { name: `Guest ${Math.floor(1000 + Math.random() * 9000)}`, color };

  try {
    window.sessionStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify({ name: generated.name }));
  } catch {}

  return generated;
}

function isSameEditingCell(left: EditingCell | null | undefined, right: EditingCell | null | undefined) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.row === right.row && left.column === right.column;
}

function createPresenceSummary(states: Map<number, AwarenessPresenceState>, localClientId: number): PresenceSummary {
  const activeEntries = Array.from(states.entries()).filter(([, state]) => state?.user);
  const editingCells = activeEntries
    .filter(([, state]) => state.editing)
    .map(([clientId, state]) => ({
      clientId,
      name: state.user!.name,
      color: state.user!.color,
      row: state.editing!.row,
      column: state.editing!.column,
      label: toA1Label(state.editing!.row, state.editing!.column),
      isLocal: clientId === localClientId,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  return {
    activeCount: activeEntries.length,
    editingCells,
  };
}

export default function UniverSheet(
  { sheetId, partyHost, onPresenceChange }: { sheetId: string; partyHost: string; onPresenceChange?: (summary: PresenceSummary) => void }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const onPresenceChangeRef = useRef(onPresenceChange);

  onPresenceChangeRef.current = onPresenceChange;

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      const { createUniver, LocaleType, merge, defaultTheme } = await import('@univerjs/presets');
      const { UniverSheetsCorePreset } = await import('@univerjs/presets/preset-sheets-core');
      const sheetsCoreEnUS = (await import('@univerjs/presets/preset-sheets-core/locales/en-US')).default;

      if (disposed || !containerRef.current) return;

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: merge({}, sheetsCoreEnUS) },
        theme: defaultTheme,
        presets: [UniverSheetsCorePreset({ container: containerRef.current })],
      });

      const workbook = univerAPI.createWorkbook({ id: sheetId, name: 'Sheet' });
      const worksheet = workbook.getActiveSheet();
      const ydoc = new Y.Doc();
      const provider = new YPartyKitProvider(partyHost, sheetId, ydoc);
      const cellState = ydoc.getMap<string>(`sheet:${sheetId}:cells`);
      const awareness = provider.awareness;
      const localPresenceUser = getPresenceUser(ydoc.clientID);
      const applyingRemoteRef = { current: false };
      const initializedRef = { current: false };
      const remoteHighlights = new Map<number, RemoteHighlight>();

      const toCellKey = (row: number, column: number) => `${CELL_KEY_PREFIX}${row}:${column}`;
      const publishPresence = (editing: EditingCell | null) => {
        const current = (awareness.getLocalState() as AwarenessPresenceState | null) ?? {};
        if (current.user?.name === localPresenceUser.name && current.user?.color === localPresenceUser.color && isSameEditingCell(current.editing, editing)) {
          return;
        }

        awareness.setLocalState({
          ...current,
          user: localPresenceUser,
          editing,
        });
      };

      const refreshPresenceUI = () => {
        const states = awareness.getStates() as Map<number, AwarenessPresenceState>;
        const summary = createPresenceSummary(states, awareness.clientID);
        onPresenceChangeRef.current?.(summary);

        const activeRemoteClientIds = new Set<number>();

        summary.editingCells
          .filter((entry) => !entry.isLocal)
          .forEach((entry) => {
            activeRemoteClientIds.add(entry.clientId);

            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.column) || entry.row < 0 || entry.column < 0) return;

            const signature = `${entry.row}:${entry.column}:${entry.color}`;
            const existing = remoteHighlights.get(entry.clientId);
            if (existing?.signature === signature) return;

            existing?.disposable.dispose();

            try {
              const range = worksheet.getRange(entry.row, entry.column, 1, 1);
              const cell = range.getCell();
              const disposable = range.highlight(
                {
                  strokeWidth: 2,
                  stroke: entry.color,
                  fill: withAlpha(entry.color, '22'),
                  widgets: { tl: false, tc: false, tr: false, ml: false, mr: false, bl: false, bc: false, br: false },
                  widgetSize: 0,
                },
                {
                  startRow: entry.row,
                  endRow: entry.row,
                  startColumn: entry.column,
                  endColumn: entry.column,
                  actualRow: cell.actualRow,
                  actualColumn: cell.actualColumn,
                  isMerged: cell.isMerged,
                  isMergedMainCell: cell.isMergedMainCell,
                }
              );

              remoteHighlights.set(entry.clientId, { signature, disposable });
            } catch (error) {
              remoteHighlights.delete(entry.clientId);
              console.error('[UniverSheet] failed to render remote presence highlight', error);
            }
          });

        for (const [clientId, highlight] of remoteHighlights.entries()) {
          if (activeRemoteClientIds.has(clientId)) continue;
          highlight.disposable.dispose();
          remoteHighlights.delete(clientId);
        }
      };

      const parseCellKey = (key: string) => {
        if (!key.startsWith(CELL_KEY_PREFIX)) return null;

        const [rowValue, columnValue] = key.slice(CELL_KEY_PREFIX.length).split(':');
        const row = Number(rowValue);
        const column = Number(columnValue);

        if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
        return { row, column };
      };

      const isEmptyCell = (cell: ICellData | null | undefined | void) => {
        if (!cell) return true;

        return (
          cell.v == null &&
          cell.f == null &&
          cell.p == null &&
          cell.s == null &&
          cell.t == null &&
          cell.si == null &&
          cell.custom == null
        );
      };

      const clearCell = (row: number, column: number) => {
        worksheet.getRange(row, column).setValue({
          v: null,
          f: null,
          p: null,
          s: null,
          t: null,
          si: null,
          custom: null,
        });
      };

      const applySharedCell = (key: string, serialized: string | undefined) => {
        const position = parseCellKey(key);
        if (!position) return;

        if (!serialized) {
          clearCell(position.row, position.column);
          return;
        }

        try {
          const cell = JSON.parse(serialized);
          worksheet.getRange(position.row, position.column).setValue(cell);
        } catch (error) {
          console.error('[UniverSheet] failed to parse remote cell payload', error);
        }
      };

      const publishCellAt = (row: number, column: number) => {
        publishRange(worksheet.getRange(row, column, 1, 1));
      };

      const publishRange = (range: ReturnType<typeof worksheet.getRange>) => {
        const { startRow, startColumn } = range.getRange();
        const grid = range.getCellDataGrid();

        ydoc.transact(() => {
          for (let rowOffset = 0; rowOffset < grid.length; rowOffset += 1) {
            const row = grid[rowOffset];
            if (!row) continue;

            for (let columnOffset = 0; columnOffset < row.length; columnOffset += 1) {
              const cell = row[columnOffset];
              const key = toCellKey(startRow + rowOffset, startColumn + columnOffset);

              if (isEmptyCell(cell)) {
                cellState.delete(key);
                continue;
              }

              cellState.set(key, JSON.stringify(cell));
            }
          }
        }, LOCAL_SYNC_ORIGIN);
      };

      const onSheetValueChanged: IDisposable = univerAPI.addEvent(univerAPI.Event.SheetValueChanged, (event) => {
        if (applyingRemoteRef.current) return;

        const { effectedRanges } = event as { effectedRanges: Array<ReturnType<typeof worksheet.getRange>> };
        effectedRanges.forEach((range) => publishRange(range));
      });

      const onSheetEditEnded: IDisposable = univerAPI.addEvent(univerAPI.Event.SheetEditEnded, (event) => {
        if (applyingRemoteRef.current) return;

        const { row, column, isConfirm } = event as { row: number; column: number; isConfirm: boolean };
        publishPresence(null);
        if (!isConfirm) return;

        window.setTimeout(() => {
          if (disposed || applyingRemoteRef.current) return;
          publishCellAt(row, column);
        }, 0);
      });

      const onSheetEditStarted: IDisposable = univerAPI.addEvent(univerAPI.Event.SheetEditStarted, (event) => {
        const { row, column } = event as { row: number; column: number };
        publishPresence({ row, column });
      });

      const handleCellStateChange = (event: Y.YMapEvent<string>, transaction: Y.Transaction) => {
        if (transaction.origin === LOCAL_SYNC_ORIGIN) return;

        applyingRemoteRef.current = true;
        try {
          event.keysChanged.forEach((key) => {
            applySharedCell(key, cellState.get(key));
          });
        } finally {
          applyingRemoteRef.current = false;
        }
      };

      const handleAwarenessChange = () => {
        refreshPresenceUI();
      };

      const handleInitialSync = (isSynced: boolean) => {
        if (!isSynced || initializedRef.current || disposed) return;
        initializedRef.current = true;

        if (cellState.size === 0) return;

        applyingRemoteRef.current = true;
        try {
          Array.from(cellState.entries())
            .filter(([key]) => key.startsWith(CELL_KEY_PREFIX))
            .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
            .forEach(([key, serialized]) => {
              applySharedCell(key, serialized);
            });
        } finally {
          applyingRemoteRef.current = false;
        }

        refreshPresenceUI();
      };

      publishPresence(null);
      cellState.observe(handleCellStateChange);
      awareness.on('change', handleAwarenessChange);
      provider.on('sync', handleInitialSync);

      if (provider.synced) {
        handleInitialSync(true);
      } else {
        refreshPresenceUI();
      }

      cleanupRef.current = () => {
        provider.off('sync', handleInitialSync);
        awareness.off('change', handleAwarenessChange);
        cellState.unobserve(handleCellStateChange);
        onSheetValueChanged.dispose();
        onSheetEditEnded.dispose();
        onSheetEditStarted.dispose();
        for (const highlight of remoteHighlights.values()) highlight.disposable.dispose();
        remoteHighlights.clear();
        onPresenceChangeRef.current?.({ activeCount: 0, editingCells: [] });
        awareness.setLocalState(null);
        provider.destroy();
        ydoc.destroy();
        univer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanupRef.current();
    };
  }, [sheetId, partyHost]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
