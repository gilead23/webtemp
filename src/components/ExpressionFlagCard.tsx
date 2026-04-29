import React, { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type {
  ExpressionFlagConfig,
  ExpressionValidationResult,
} from '../types/expression';
import type { ExpressionRegistry } from '../types/expression_registry';
import { ExpressionBuilder } from './ExpressionBuilder';

/**
 * COMMERCIAL-STYLE EXPRESSION EDITOR
 *
 * This is a drop-in replacement for the previous ExpressionFlagCard.
 * Behaviour guarantees:
 * - Same props and onChange contract.
 * - Still drives a single raw expression string (value.raw).
 * - Validation callback is preserved and called on every semantic change.
 * - AST is currently not populated (ast: null) – backend still parses raw DSL.
 */

export interface ExpressionFlagCardProps {
  value: ExpressionFlagConfig;
  onChange: (next: ExpressionFlagConfig) => void;
  registry: ExpressionRegistry;
  onValidateExpression?: (raw: string) => Promise<ExpressionValidationResult>;
  disabled?: boolean;
}

type Mode = 'visual' | 'raw';
type GroupMode = 'all' | 'any';

interface ConditionRow {
  id: string;
  left: string;
  op: string;
  value: string;
}

let ROW_COUNTER = 0;
const nextRowId = () => `row-${++ROW_COUNTER}`;

export const ExpressionFlagCard: React.FC<ExpressionFlagCardProps> = ({
  value,
  onChange,
  registry,
  onValidateExpression,
  disabled,
}) => {
  const mode: Mode = (value.mode as Mode) || 'visual';
  const [groupMode, setGroupMode] = useState<GroupMode>('all');
  const [rows, setRows] = useState<ConditionRow[]>(() =>
    initialRowsFromRaw(value.raw),
  );

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[ExpressionFlagCard] mount');
    return () => {
      // eslint-disable-next-line no-console
      console.log('[ExpressionFlagCard] unmount');
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[ExpressionFlagCard] props', {
      mode: value.mode,
      rawLength: value.raw?.length ?? 0,
      disabled: !!disabled,
    });
  }, [value.mode, value.raw, disabled]);

  // keep local builder state in sync when raw changes externally
  useEffect(() => {
    setRows(initialRowsFromRaw(value.raw));
  }, [value.raw]);

  const runValidation = (nextRaw: string): void => {
    if (!onValidateExpression) return;
    onValidateExpression(nextRaw).catch((err) => {
      // single warning, avoid spam – but do not throw
      // eslint-disable-next-line no-console
      console.warn('[ExpressionFlagCard] validation failed', err);
    });
  };

  const emitChange = (nextRaw: string) => {
    const next: ExpressionFlagConfig = {
      ...value,
      raw: nextRaw,
      ast: null,
      validation: value.validation,
      mode,
    };
    onChange(next);
    runValidation(nextRaw);
  };

  const emitFullConfig = (next: ExpressionFlagConfig) => {
    onChange(next);
    if (next.raw) runValidation(next.raw);
  };

  const handleModeToggle = (nextMode: Mode) => {
    if (nextMode === mode) return;
    emitFullConfig({ ...value, mode: nextMode });
  };

  const handleRawChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const nextRaw = e.target.value;
    emitChange(nextRaw);
  };

  const handlePaletteInsert = (snippet: string) => {
    if (!snippet) return;
    const trimmed = (value.raw || '').trim();
    const nextRaw = trimmed ? `${trimmed} ${snippet}` : snippet;
    emitChange(nextRaw);
  };

  const handleGroupModeChange = (gm: GroupMode) => {
    setGroupMode(gm);
    const nextRaw = buildRawFromRows(rows, gm);
    emitChange(nextRaw);
  };

  const handleRowChange = (id: string, patch: Partial<ConditionRow>) => {
    const nextRows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(nextRows);
    const nextRaw = buildRawFromRows(nextRows, groupMode);
    emitChange(nextRaw);
  };

  const handleAddRow = () => {
    const nextRows = [
      ...rows,
      {
        id: nextRowId(),
        left: 'close()',
        op: '>',
        value: '',
      },
    ];
    setRows(nextRows);
    const nextRaw = buildRawFromRows(nextRows, groupMode);
    emitChange(nextRaw);
  };

  const handleDeleteRow = (id: string) => {
    const nextRows = rows.filter((r) => r.id !== id);
    const finalRows = nextRows.length ? nextRows : [makeEmptyRow()];
    setRows(finalRows);
    const nextRaw = buildRawFromRows(finalRows, groupMode);
    emitChange(nextRaw);
  };

  const modeButtonClass = (active: boolean) =>
    'px-3 py-1 text-[11px] rounded-full border ' +
    (active
      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50');

  const isValid = !!value.validation?.ok;

  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/80 text-xs flex flex-col shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/90">
        <div className="flex flex-col">
          <span className="font-semibold text-[12px] text-slate-50">
            Expression
          </span>
          <span className="text-[10px] text-slate-400">
            Build conditions visually or edit the raw DSL.
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-1 py-1 border border-slate-700">
          <button
            type="button"
            className={modeButtonClass(mode === 'visual')}
            onClick={() => handleModeToggle('visual')}
            disabled={disabled}
          >
            Visual
          </button>
          <button
            type="button"
            className={modeButtonClass(mode === 'raw')}
            onClick={() => handleModeToggle('raw')}
            disabled={disabled}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Body */}
<div className="flex min-h-[260px]">
  <div className="flex-1 flex flex-col">
    {mode === 'visual' ? (
      <ExpressionBuilder
        ast={value.ast ?? ((value.raw && value.raw.trim().length > 0) ? ({ kind: 'raw_fragment', text: value.raw } as any) : null)}
        onChange={(next) => {
          if (disabled) return;
          if (!next) {
            emitChange('');
            return;
          }
          const expr: any = next;
          if (expr && (expr as any).kind === 'raw_fragment') {
            const text =
              typeof (expr as any).text === 'string' ? (expr as any).text : '';
            emitChange(text);
          }
        }}
          // an AST-derived raw string.
        registry={registry}
        validation={value.validation}
        disabled={disabled}
      />
    ) : (
      <RawEditorPanel
        raw={value.raw || ''}
        onChangeRaw={handleRawChange}
        validation={value.validation}
        disabled={disabled}
      />
    )}
  </div>
</div>

{/* Footer */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/90 text-[10px] flex items-center justify-between gap-2">
        <div className="truncate font-mono text-slate-200">
          {value.raw?.trim() || 'No expression defined yet.'}
        </div>
        <ValidationBadge validation={value.validation} isValid={isValid} />
      </div>
    </div>
  );
};

// --- Palette ---

interface ExpressionPaletteProps {
  registry: ExpressionRegistry;
  onInsert: (snippet: string) => void;
  disabled?: boolean;
}

const ExpressionPalette: React.FC<ExpressionPaletteProps> = ({
  registry,
  onInsert,
  disabled,
}) => {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const byCategory: Record<string, any[]> = {};
    const functions = registry?.functions ?? [];
    for (const fn of functions) {
      const category = (fn as any).category || 'Other';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(fn);
    }
    const entries = Object.entries(byCategory).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries
      .map(([cat, fns]) => [
        cat,
        (fns as any[]).filter((fn) => {
          const text = `${fn.name} ${fn.label} ${
            (fn as any).description ?? ''
          }`.toLowerCase();
          return text.includes(q);
        }),
      ])
      .filter(([, fns]) => (fns as any[]).length > 0);
  }, [registry, query]);

  const handleInsertClick = (fn: any) => {
    if (disabled) return;
    const snippet = buildFunctionSnippet(fn);
    onInsert(snippet);
  };

  return (
    <div className="h-full flex flex-col text-[11px] text-slate-100">
      <div className="px-3 py-2 border-b border-slate-800">
        <input
          type="text"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Search functions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 ? (
          <div className="px-3 py-3 text-slate-500 text-[11px]">
            No functions match this search.
          </div>
        ) : (
          grouped.map(([category, fns]) => (
            <div key={category} className="border-b border-slate-900/60">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-950 sticky top-0 z-10">
                {category}
              </div>
              <div className="py-1">
                {(fns as any[]).map((fn) => (
                  <button
                    key={fn.name}
                    type="button"
                    onClick={() => handleInsertClick(fn)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/70 transition-colors"
                    disabled={disabled}
                  >
                    <div className="text-[11px] font-medium text-slate-50 truncate">
                      {fn.label || fn.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {buildFunctionSnippet(fn)}
                    </div>
                    {(fn as any).description && (
                      <div className="text-[10px] text-slate-500 truncate">
                        {(fn as any).description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const buildFunctionSnippet = (fn: any): string => {
  try {
    const args = Array.isArray(fn.args) ? fn.args : [];
    if (!args.length) {
      return `${fn.name}()`;
    }
    const argNames = args.map((a: any) => a?.name || 'arg').join(', ');
    return `${fn.name}(${argNames})`;
  } catch {
    return `${fn?.name ?? 'fn'}()`;
  }
};

// --- Visual builder ---

interface VisualBuilderPanelProps {
  rows: ConditionRow[];
  groupMode: GroupMode;
  onGroupModeChange: (mode: GroupMode) => void;
  onRowChange: (id: string, patch: Partial<ConditionRow>) => void;
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
  disabled?: boolean;
}

const VisualBuilderPanel: React.FC<VisualBuilderPanelProps> = ({
  rows,
  groupMode,
  onGroupModeChange,
  onRowChange,
  onAddRow,
  onDeleteRow,
  disabled,
}) => {
  return (
    <div className="flex-1 flex flex-col px-4 py-3 gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          <span className="text-slate-400">Match</span>
          <select
            className="text-[11px] rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={groupMode}
            onChange={(e) => onGroupModeChange(e.target.value as GroupMode)}
            disabled={disabled}
          >
            <option value="all">All conditions (AND)</option>
            <option value="any">Any condition (OR)</option>
          </select>
          <span className="text-slate-500 text-[10px]">
            {groupMode === 'all'
              ? 'Every row must be true.'
              : 'At least one row must be true.'}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-[11px] px-3 py-1 text-white transition-colors"
        >
          <span className="text-sm leading-none">＋</span>
          Add condition
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2"
          >
            <div className="w-6 text-[10px] text-slate-500 text-center">
              {idx + 1}
            </div>
            <div className="flex-1">
              <input
                className="w-full text-[11px] rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="left side (e.g. close(), sma(close(), 20))"
                value={row.left}
                onChange={(e) => onRowChange(row.id, { left: e.target.value })}
                disabled={disabled}
              />
              <div className="text-[10px] text-slate-500 mt-0.5">
                Indicator or field
              </div>
            </div>
            <div className="w-28">
              <select
                className="w-full text-[11px] rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={row.op}
                onChange={(e) => onRowChange(row.id, { op: e.target.value })}
                disabled={disabled}
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value="crosses_above">crosses_above</option>
                <option value="crosses_below">crosses_below</option>
              </select>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Comparison
              </div>
            </div>
            <div className="flex-1">
              <input
                className="w-full text-[11px] rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="right side (e.g. 0, 20, sma(close(), 50))"
                value={row.value}
                onChange={(e) => onRowChange(row.id, { value: e.target.value })}
                disabled={disabled}
              />
              <div className="text-[10px] text-slate-500 mt-0.5">
                Value, list or expression
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDeleteRow(row.id)}
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-400 hover:bg-rose-500/10 text-xs transition-colors"
              disabled={disabled}
              title="Remove row"
              aria-label="Remove row"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Raw editor ---

interface RawEditorPanelProps {
  raw: string;
  onChangeRaw: React.ChangeEventHandler<HTMLTextAreaElement>;
  validation?: ExpressionValidationResult;
  disabled?: boolean;
}

const RawEditorPanel: React.FC<RawEditorPanelProps> = ({
  raw,
  onChangeRaw,
  validation,
  disabled,
}) => {
  return (
    <div className="flex-1 flex px-4 py-3 gap-4">
      <div className="flex-1 flex flex-col">
        <textarea
          className="flex-1 w-full resize-none rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="mfi(14) < 20 and close() > sma(close(), 20)"
          value={raw}
          onChange={onChangeRaw}
          spellCheck={false}
          disabled={disabled}
        />
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>Raw DSL expression</span>
          <span>
            {raw.trim().length}{' '}
            <span className="text-slate-400">chars</span>
          </span>
        </div>
      </div>
      <div className="w-64 flex flex-col rounded-xl bg-slate-950 border border-slate-800 px-3 py-3 text-[11px] text-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-100">Validation</span>
          <span
            className={
              'px-2 py-0.5 rounded-full border text-[10px] ' +
              (validation?.ok
                ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/60 text-rose-200')
            }
          >
            {validation?.ok ? 'valid' : 'invalid'}
          </span>
        </div>
        {validation?.ok ? (
          <p className="text-[11px] text-slate-400">
            Expression compiled successfully. Any additional semantic issues
            will be surfaced at run time.
          </p>
        ) : validation?.errors?.length ? (
          <ul className="list-disc pl-4 space-y-1 text-rose-200">
            {validation.errors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-500">
            No validation result yet. Expression will be parsed when you apply
            changes.
          </p>
        )}
      </div>
    </div>
  );
};

// --- Validation badge ---

interface ValidationBadgeProps {
  validation?: ExpressionValidationResult;
  isValid: boolean;
}

const ValidationBadge: React.FC<ValidationBadgeProps> = ({
  validation,
  isValid,
}) => {
  if (!validation) {
    return (
      <span className="text-slate-500">
        Not validated
      </span>
    );
  }
  if (isValid) {
    return (
      <span className="px-2 py-0.5 rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-200">
        valid
      </span>
    );
  }
  const first = validation.errors[0];
  return (
    <span className="px-2 py-0.5 rounded-full border border-rose-500/60 bg-rose-500/10 text-rose-200">
      {first?.code ?? 'invalid'}
    </span>
  );
};

// --- helpers ---

function initialRowsFromRaw(raw: string | undefined | null): ConditionRow[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return [makeEmptyRow()];
  }
  // Very light heuristic: split on " and " / " or " and keep first piece.
  const firstClause = trimmed
    .split(/\s+(and|or)\s+/i)[0]
    .trim();
  const defaultRow = makeEmptyRow();
  defaultRow.left = 'close()';
  defaultRow.op = '>';
  defaultRow.value = firstClause.includes(' ')
    ? firstClause.split(/\s+/).slice(-1)[0]
    : '';
  return [defaultRow];
}

function makeEmptyRow(): ConditionRow {
  return {
    id: nextRowId(),
    left: 'close()',
    op: '>',
    value: '',
  };
}

function buildRawFromRows(rows: ConditionRow[], groupMode: GroupMode): string {
  const glue = groupMode === 'all' ? ' and ' : ' or ';
  const parts = rows
    .map((r) => r)
    .filter((r) => r.left && r.op && r.value)
    .map(
      (r) =>
        `${r.left.trim()} ${r.op.trim()} ${r.value.trim()}`,
    );
  return parts.join(glue);
}