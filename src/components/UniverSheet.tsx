'use client';
import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import type { ICellData, IDisposable, IRange } from '@univerjs/core';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';

const CELL_KEY_PREFIX = 'cell:';
const SNAPSHOT_KEY = 'workbookSnapshot';
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

export type ActivitySummary = {
  id: string;
  label: string;
  detail: string;
  actor: string;
  createdAt: number;
};

type RemoteHighlight = {
  signature: string;
  disposable: IDisposable;
};

type PublishableRange = {
  getRange(): IRange;
};

type SheetCommandParams = {
  unitId?: string;
  subUnitId?: string;
  range?: IRange | null;
  ranges?: IRange[] | null;
};

type SerializableWorkbook = {
  save(): unknown;
  getId(): string;
  getActiveSheet(): {
    getSheet(): {
      getRange(range: IRange): {
        getObjectValue(options?: { isIncludeStyle?: boolean }): ICellData | null | undefined | void;
      };
    };
    getSheetId(): string;
    getSelection(): {
      getActiveRangeList(): PublishableRange[];
    } | null;
    getActiveRange(): PublishableRange | null;
    getRange(row: number, column: number, numRows?: number, numColumns?: number): PublishableRange & {
      getCell(): {
        actualRow: number;
        actualColumn: number;
        isMerged: boolean;
        isMergedMainCell: boolean;
      };
      setValue(value: unknown): void;
      highlight(config: unknown, range: unknown): IDisposable;
    };
  };
  onCommandExecuted(callback: (command: { id: string; params?: object }) => void): IDisposable;
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
  {
    sheetId,
    partyHost,
    onPresenceChange,
    onActivityChange,
  }: {
    sheetId: string;
    partyHost: string;
    onPresenceChange?: (summary: PresenceSummary) => void;
    onActivityChange?: (entry: ActivitySummary) => void;
  }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onActivityChangeRef = useRef(onActivityChange);

  onPresenceChangeRef.current = onPresenceChange;
  onActivityChangeRef.current = onActivityChange;

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      const { createUniver, LocaleType, merge, defaultTheme } = await import('@univerjs/presets');
      const { UniverSheetsCorePreset } = await import('@univerjs/presets/preset-sheets-core');
      const sheetsCoreEnUS = (await import('@univerjs/presets/preset-sheets-core/locales/en-US')).default;
      const { UniverSheetsConditionalFormattingPreset } = await import('@univerjs/presets/preset-sheets-conditional-formatting');
      const sheetsCFEnUS = (await import('@univerjs/presets/preset-sheets-conditional-formatting/locales/en-US')).default;
      const {
        AddWorksheetMergeCommand,
        AddWorksheetMergeAllCommand,
        DeleteWorksheetRangeThemeStyleCommand,
        DeltaColumnWidthCommand,
        DeltaRowHeightCommand,
        ResetBackgroundColorCommand,
        ResetTextColorCommand,
        SetBackgroundColorCommand,
        SetBoldCommand,
        SetBorderBasicCommand,
        SetBorderColorCommand,
        SetBorderCommand,
        SetBorderPositionCommand,
        SetBorderStyleCommand,
        SetColDataCommand,
        SetColWidthCommand,
        SetFontFamilyCommand,
        SetFontSizeCommand,
        SetHorizontalTextAlignCommand,
        SetItalicCommand,
        SetOverlineCommand,
        SetRowDataCommand,
        SetRowHeightCommand,
        SetStrikeThroughCommand,
        SetStyleCommand,
        SetTextColorCommand,
        SetTextRotationCommand,
        SetTextWrapCommand,
        SetUnderlineCommand,
        SetWorksheetColWidthMutation,
        SetWorksheetDefaultStyleCommand,
        SetWorksheetRangeThemeStyleCommand,
        SetWorksheetRowAutoHeightMutation,
        SetWorksheetRowHeightMutation,
        SetWorksheetRowIsAutoHeightMutation,
        SetVerticalTextAlignCommand,
      } = await import('@univerjs/sheets');
      const {
        IMenuManagerService,
        MenuItemType,
        RibbonStartGroup,
      } = await import('@univerjs/ui');
      const {
        AddConditionalRuleMutation,
        DeleteConditionalRuleMutation,
        MoveConditionalRuleMutation,
        SetConditionalRuleMutation,
      } = await import('@univerjs/sheets-conditional-formatting');
      const { IRenderManagerService } = await import('@univerjs/engine-render');

      const ydoc = new Y.Doc();
      const provider = new YPartyKitProvider(partyHost, sheetId, ydoc);
      const cellState = ydoc.getMap<string>(`sheet:${sheetId}:cells`);
      const snapshotState = ydoc.getMap<string>(`sheet:${sheetId}:meta`);
      const awareness = provider.awareness;
      const styleSyncCommandIds = new Set([
        ResetBackgroundColorCommand.id,
        ResetTextColorCommand.id,
        SetBackgroundColorCommand.id,
        SetBoldCommand.id,
        SetBorderBasicCommand.id,
        SetBorderColorCommand.id,
        SetBorderCommand.id,
        SetBorderPositionCommand.id,
        SetBorderStyleCommand.id,
        SetFontFamilyCommand.id,
        SetFontSizeCommand.id,
        SetHorizontalTextAlignCommand.id,
        SetItalicCommand.id,
        SetOverlineCommand.id,
        SetStrikeThroughCommand.id,
        SetStyleCommand.id,
        SetTextColorCommand.id,
        SetTextRotationCommand.id,
        SetTextWrapCommand.id,
        SetUnderlineCommand.id,
        SetVerticalTextAlignCommand.id,
      ]);
      const workbookSnapshotCommandIds = new Set([
        ...styleSyncCommandIds,
        SetColWidthCommand.id,
        DeltaColumnWidthCommand.id,
        SetRowHeightCommand.id,
        DeltaRowHeightCommand.id,
        SetWorksheetColWidthMutation.id,
        SetWorksheetDefaultStyleCommand.id,
        SetWorksheetRowAutoHeightMutation.id,
        SetWorksheetRowHeightMutation.id,
        SetWorksheetRowIsAutoHeightMutation.id,
        SetRowDataCommand.id,
        SetColDataCommand.id,
        SetWorksheetRangeThemeStyleCommand.id,
        DeleteWorksheetRangeThemeStyleCommand.id,
        AddConditionalRuleMutation.id,
        DeleteConditionalRuleMutation.id,
        MoveConditionalRuleMutation.id,
        SetConditionalRuleMutation.id,
      ]);
      const localPresenceUser = getPresenceUser(ydoc.clientID);
      const applyingRemoteRef = { current: false };
      const initializedRef = { current: false };
      const remoteHighlights = new Map<number, RemoteHighlight>();
      const activitySignatures = new Map<string, string>();
      const emitActivity = (entry: Omit<ActivitySummary, 'id' | 'createdAt'>) => {
        onActivityChangeRef.current?.({
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        });
      };

      const describeCellActivity = (cell: ICellData | null | undefined | void) => {
        if (!cell || (cell.v == null && cell.f == null && cell.p == null && cell.s == null && cell.t == null && cell.si == null && cell.custom == null)) {
          return { signature: 'empty', detail: 'Cleared cell' };
        }

        const signature = JSON.stringify([cell.v ?? null, cell.f ?? null, cell.p ?? null, cell.s ?? null, cell.t ?? null, cell.si ?? null, cell.custom ?? null]);
        if (cell.f != null) return { signature, detail: `Formula: ${String(cell.f)}` };
        if (cell.v != null) return { signature, detail: `Value: ${String(cell.v)}` };
        if (cell.p != null) return { signature, detail: 'Formatting changed' };
        return { signature, detail: 'Updated cell' };
      };

      const recordActivity = (row: number, column: number, actor: string, cell: ICellData | null | undefined | void) => {
        const key = `${row}:${column}`;
        const { signature, detail } = describeCellActivity(cell);
        if (activitySignatures.get(key) === signature) return;
        activitySignatures.set(key, signature);
        emitActivity({
          label: toA1Label(row, column),
          detail,
          actor,
        });
      };

      const waitForInitialSync = async () => {
        if (provider.synced) return;

        await new Promise<void>((resolve) => {
          const handleSync = (isSynced: boolean) => {
            if (!isSynced) return;
            provider.off('sync', handleSync);
            resolve();
          };

          provider.on('sync', handleSync);
        });
      };

      await waitForInitialSync();
      if (disposed || !containerRef.current) return;

      let initialWorkbookData: { id: string; name: string } | Record<string, unknown> = { id: sheetId, name: 'Sheet' };
      const serializedSnapshot = snapshotState.get(SNAPSHOT_KEY);

      if (serializedSnapshot) {
        try {
          initialWorkbookData = JSON.parse(serializedSnapshot) as Record<string, unknown>;
        } catch (error) {
          console.error('[UniverSheet] failed to parse workbook snapshot', error);
        }
      }

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: merge({}, sheetsCoreEnUS, sheetsCFEnUS) },
        theme: defaultTheme,
        presets: [
          UniverSheetsCorePreset({ container: containerRef.current }),
          UniverSheetsConditionalFormattingPreset(),
        ],
      });

      // Replace the merge dropdown with a one-click "merge all" button.
      try {
        const injector = (univer as unknown as { __getInjector(): { get<T>(id: unknown): T } }).__getInjector();
        const menuManager = injector.get<{
          mergeMenu(schema: Record<string, unknown>): void;
        }>(IMenuManagerService);
        menuManager.mergeMenu({
          [RibbonStartGroup.LAYOUT]: {
            [AddWorksheetMergeCommand.id]: {
              menuItemFactory: () => ({
                id: AddWorksheetMergeAllCommand.id,
                type: MenuItemType.BUTTON,
                icon: 'MergeAllSingle',
                tooltip: 'toolbar.mergeCell.main',
              }),
            },
          },
        });
      } catch (error) {
        console.error('[UniverSheet] failed to override merge menu', error);
      }

      const workbook = univerAPI.createWorkbook(initialWorkbookData as Parameters<typeof univerAPI.createWorkbook>[0]) as SerializableWorkbook;
      const worksheet = workbook.getActiveSheet();
      const coreWorksheet = worksheet.getSheet();

      // Make the canvas scrollbars finger-friendly on touch devices.
      try {
        const isCoarsePointer =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(pointer: coarse)').matches;
        if (isCoarsePointer) {
          const injector = (univer as unknown as { __getInjector(): { get<T>(id: unknown): T } }).__getInjector();
          const renderManager = injector.get<{
            getRenderById(id: string): {
              scene?: {
                getViewports(): Array<{
                  getScrollBar(): null | {
                    barSize: number;
                    minThumbSizeH?: number;
                    minThumbSizeV?: number;
                  };
                  resetCanvasSizeAndUpdateScroll?(): void;
                }>;
              };
            } | null;
          }>(IRenderManagerService);

          const applyTouchScrollbar = () => {
            const render = renderManager.getRenderById(workbook.getId());
            const viewports = render?.scene?.getViewports?.() ?? [];
            let touched = false;
            viewports.forEach((vp) => {
              const bar = vp.getScrollBar?.();
              if (!bar) return;
              bar.barSize = 22;
              bar.minThumbSizeH = 60;
              bar.minThumbSizeV = 60;
              vp.resetCanvasSizeAndUpdateScroll?.();
              touched = true;
            });
            return touched;
          };

          if (!applyTouchScrollbar()) {
            // Scrollbars are created lazily after first layout pass — retry shortly.
            window.setTimeout(applyTouchScrollbar, 200);
            window.setTimeout(applyTouchScrollbar, 800);
          }
        }
      } catch (error) {
        console.error('[UniverSheet] failed to enlarge touch scrollbar', error);
      }

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

      const applySharedCell = (key: string, serialized: string | undefined, emitHistory = true) => {
        const position = parseCellKey(key);
        if (!position) return;

        if (!serialized) {
          clearCell(position.row, position.column);
          return;
        }

        try {
          const cell = JSON.parse(serialized);
          worksheet.getRange(position.row, position.column).setValue(cell);
          if (emitHistory) recordActivity(position.row, position.column, 'Collaborator', cell);
        } catch (error) {
          console.error('[UniverSheet] failed to parse remote cell payload', error);
        }
      };

      const publishCellAt = (row: number, column: number) => {
        publishRange(worksheet.getRange(row, column, 1, 1));
      };

      const publishWorkbookSnapshot = () => {
        try {
          snapshotState.set(SNAPSHOT_KEY, JSON.stringify(workbook.save()));
        } catch (error) {
          console.error('[UniverSheet] failed to serialize workbook snapshot', error);
        }
      };

      const publishRange = (range: PublishableRange) => {
        const { startRow, startColumn, endRow, endColumn } = range.getRange();

        ydoc.transact(() => {
          for (let row = startRow; row <= endRow; row += 1) {
            for (let column = startColumn; column <= endColumn; column += 1) {
              const cell = coreWorksheet.getRange({ startRow: row, endRow: row, startColumn: column, endColumn: column }).getObjectValue({
                isIncludeStyle: true,
              });
              const key = toCellKey(row, column);
              const previous = cellState.get(key);

              if (isEmptyCell(cell)) {
                if (previous !== undefined) cellState.delete(key);
                continue;
              }

              const next = JSON.stringify(cell);
              if (previous === next) continue;
              cellState.set(key, next);
            }
          }
        }, LOCAL_SYNC_ORIGIN);
      };

      const toWorksheetRange = (range: IRange) =>
        worksheet.getRange(
          range.startRow,
          range.startColumn,
          range.endRow - range.startRow + 1,
          range.endColumn - range.startColumn + 1
        );

      const publishCurrentSelection = () => {
        const selection = worksheet.getSelection();
        const activeRanges = selection?.getActiveRangeList() ?? [];

        if (activeRanges.length > 0) {
          activeRanges.forEach((range) => publishRange(range));
          return;
        }

        const activeRange = worksheet.getActiveRange();
        if (activeRange) publishRange(activeRange);
      };

      const publishCommandRanges = (params?: SheetCommandParams) => {
        const workbookId = workbook.getId();
        const sheetId = worksheet.getSheetId();

        if (params?.unitId && params.unitId !== workbookId) return;
        if (params?.subUnitId && params.subUnitId !== sheetId) return;

        const explicitRanges = [params?.range, ...(params?.ranges ?? [])].filter((range): range is IRange => Boolean(range));

        if (explicitRanges.length > 0) {
          explicitRanges.forEach((range) => publishRange(toWorksheetRange(range)));
          return;
        }

        publishCurrentSelection();
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
          recordActivity(row, column, 'You', coreWorksheet.getRange({ startRow: row, endRow: row, startColumn: column, endColumn: column }).getObjectValue({
            isIncludeStyle: true,
          }));
        }, 0);
      });

      const onSheetEditStarted: IDisposable = univerAPI.addEvent(univerAPI.Event.SheetEditStarted, (event) => {
        const { row, column } = event as { row: number; column: number };
        publishPresence({ row, column });
      });

      const onSheetCommandExecuted = workbook.onCommandExecuted((command) => {
        if (applyingRemoteRef.current) return;

        if (styleSyncCommandIds.has(command.id)) {
          publishCommandRanges(command.params as SheetCommandParams | undefined);
        }

        if (!workbookSnapshotCommandIds.has(command.id)) return;

        window.setTimeout(() => {
          if (disposed || applyingRemoteRef.current) return;
          publishWorkbookSnapshot();
        }, 0);
      });

      const handleCellStateChange = (event: Y.YMapEvent<string>, transaction: Y.Transaction) => {
        if (transaction.origin === LOCAL_SYNC_ORIGIN) return;

        applyingRemoteRef.current = true;
        try {
          event.keysChanged.forEach((key) => {
            applySharedCell(key, cellState.get(key), initializedRef.current);
          });
        } finally {
          applyingRemoteRef.current = false;
        }
      };

      const handleAwarenessChange = () => {
        refreshPresenceUI();
      };

      const handleInitialSync = () => {
        if (initializedRef.current || disposed) return;
        initializedRef.current = true;

        applyingRemoteRef.current = true;
        try {
          Array.from(cellState.entries())
            .filter(([key]) => key.startsWith(CELL_KEY_PREFIX))
            .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
            .forEach(([key, serialized]) => {
              const position = parseCellKey(key);
              if (!position) return;
              applySharedCell(key, serialized, false);
              try {
                const cell = serialized ? JSON.parse(serialized) as ICellData : null;
                const { signature } = describeCellActivity(cell);
                activitySignatures.set(`${position.row}:${position.column}`, signature);
              } catch {
                activitySignatures.set(`${key.slice(CELL_KEY_PREFIX.length)}`, 'empty');
              }
            });
        } finally {
          applyingRemoteRef.current = false;
        }

        refreshPresenceUI();
      };

      publishPresence(null);
      cellState.observe(handleCellStateChange);
      awareness.on('change', handleAwarenessChange);
      handleInitialSync();

      cleanupRef.current = () => {
        awareness.off('change', handleAwarenessChange);
        cellState.unobserve(handleCellStateChange);
        onSheetValueChanged.dispose();
        onSheetEditEnded.dispose();
        onSheetEditStarted.dispose();
        onSheetCommandExecuted.dispose();
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
