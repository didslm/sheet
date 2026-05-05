'use client';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import type { ICellData, IDisposable } from '@univerjs/core';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

const CELL_KEY_PREFIX = 'cell:';
const LOCAL_SYNC_ORIGIN = 'opensheets-univer-sync';

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
      const applyingRemoteRef = { current: false };
      const initializedRef = { current: false };

      const toCellKey = (row: number, column: number) => `${CELL_KEY_PREFIX}${row}:${column}`;
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
      };

      cellState.observe(handleCellStateChange);
      provider.on('sync', handleInitialSync);

      if (provider.synced) handleInitialSync(true);

      cleanupRef.current = () => {
        provider.off('sync', handleInitialSync);
        cellState.unobserve(handleCellStateChange);
        onSheetValueChanged.dispose();
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
