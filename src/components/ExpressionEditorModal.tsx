import { useEffect, useRef, useState } from 'react';
import { ExpressionBuilder } from './ExpressionBuilder';
import { expandSweepMarkers, hasSweepMarkers, countSweepPermutations } from '../utils/sweepMarkers';
import type { ExpressionFlagConfig } from '../types/expression';
import type { ExpressionRegistry } from '../types/expression_registry';
import { fetchExpressionRegistry } from '../services/expressionRegistryClient';
import type { SelectedStrategy } from './StrategyPicker';

const DEFAULT_EXPRESSION_REGISTRY: ExpressionRegistry = {
  fields: [],
  functions: [],
  operators: [],
  flags: [],
  error: null,
};

interface BaseProps {
  onClose: () => void;
}

interface EntryExitProps extends BaseProps {
  kind: 'entry' | 'exit';
  /** If editing an existing strategy, pass it here. */
  initial?: SelectedStrategy;
  onSave: (strategy: SelectedStrategy) => void;
  onSaveColumn?: never;
  initialExpression?: never;
  initialName?: never;
}

interface ColumnProps extends BaseProps {
  kind: 'column';
  initial?: never;
  onSave?: never;
  /** Called when the user confirms a column expression. */
  onSaveColumn: (expression: string, name: string) => void;
  /** Pre-fill the expression text when editing an existing column. */
  initialExpression?: string;
  /** Pre-fill the column name. */
  initialName?: string;
}

type ExpressionEditorModalProps = EntryExitProps | ColumnProps;

/**
 * Shared expression editor modal used for:
 *   - Entry / exit flag expressions in New Sweep (kind='entry' | 'exit')
 *   - Screener column expressions (kind='column')
 *
 * When kind='column':
 *   - Header reads "Column Expression"
 *   - Label input becomes the column name field
 *   - Sweep-marker expansion is suppressed (not meaningful for scalar output columns)
 *   - The fields section is opened by default so datasets are immediately visible
 *   - onSaveColumn(expression, name) is called instead of onSave
 */
export default function ExpressionEditorModal(props: ExpressionEditorModalProps) {
  const { kind, onClose } = props;

  const [registry, setRegistry] = useState<ExpressionRegistry>(DEFAULT_EXPRESSION_REGISTRY);
  const [loading, setLoading] = useState(true);

  // ── Derive initial expression text ──────────────────────────────────────
  const initialRaw = (() => {
    if (kind === 'column') {
      return props.initialExpression?.trim() ?? '';
    }
    // entry / exit
    const initial = props.initial;
    if (!initial) return '';
    const tmpl = initial.params?._sweep_template;
    if (Array.isArray(tmpl) && tmpl.length > 0 && String(tmpl[0]).trim()) {
      return String(tmpl[0]);
    }
    const expr = initial.params?.expression;
    if (Array.isArray(expr) && expr.length > 0) return String(expr[0]);
    if (initial.label && initial.label !== initial.name && initial.label !== 'ExpressionFlagV2') {
      return initial.label;
    }
    return '';
  })();

  const initialLabel = (() => {
    if (kind === 'column') return props.initialName ?? '';
    return props.initial?.label ?? '';
  })();

  const [config, setConfig] = useState<ExpressionFlagConfig>({
    ast: initialRaw ? ({ kind: 'raw_fragment', text: initialRaw } as any) : null,
    raw: initialRaw,
    mode: 'visual',
    validation: undefined,
  });

  const [label, setLabel] = useState(initialLabel);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExpressionRegistry()
      .then((reg) => {
        if (!cancelled) { setRegistry(reg); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const raw = (config.raw || '').trim();
  const canSave = raw.length > 0;

  // Sweep markers only meaningful for entry/exit, not column
  const hasSweeps = kind !== 'column' && hasSweepMarkers(raw);
  const sweepCount = hasSweeps ? countSweepPermutations(raw) : 1;

  const handleSave = () => {
    if (!canSave) return;

    if (kind === 'column') {
      const colName = label.trim() || raw;
      props.onSaveColumn(raw, colName);
      return;
    }

    // entry / exit
    const displayLabel = label.trim() || raw;
    if (hasSweeps) {
      const expanded = expandSweepMarkers(raw);
      props.onSave({
        name: 'ExpressionFlagV2',
        label: displayLabel,
        params: { expression: expanded, _sweep_template: [raw] },
      });
    } else {
      props.onSave({
        name: 'ExpressionFlagV2',
        label: displayLabel,
        params: { expression: [raw] },
      });
    }
  };

  // ── Header text ──────────────────────────────────────────────────────────
  const isEditing = kind === 'column'
    ? !!(props.initialExpression?.trim())
    : !!props.initial;

  const headerText = kind === 'column'
    ? (isEditing ? 'Edit Column Expression' : 'Add Column Expression')
    : `${isEditing ? 'Edit' : 'Add'} ${kind === 'entry' ? 'Entry' : 'Exit'} Expression`;

  const labelPlaceholder = kind === 'column'
    ? 'Column name (e.g. Close, RSI 14)'
    : 'Optional label (defaults to expression text)';

  const saveLabel = kind === 'column'
    ? 'Apply'
    : `${isEditing ? 'Save' : 'Add'}${hasSweeps ? ` (${sweepCount})` : ''}`;

  // For column mode, open the fields section by default so datasets are visible immediately
  const initialExpanded = kind === 'column' ? ['section:fields'] : undefined;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        zIndex: 2000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden',
      }}
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="card"
        style={{
          width: 960, maxWidth: '95vw', height: '90vh',
          display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{headerText}</h3>
            {loading && <span className="hint">loading registry…</span>}
          </div>
          <button className="button ghost" onClick={onClose}>✕</button>
        </div>

        {/* Label / name input */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {kind === 'column' ? 'Name' : 'Label'}
          </span>
          <input
            ref={labelRef}
            type="text"
            className="input"
            style={{ flex: 1, height: 32, fontSize: 12 }}
            placeholder={labelPlaceholder}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Expression builder */}
        <div style={{
          flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', padding: '12px 16px', gap: 8,
        }}>
          <ExpressionBuilder
            ast={config.ast ?? ((config.raw && config.raw.trim().length > 0)
              ? ({ kind: 'raw_fragment', text: config.raw } as any)
              : null)}
            onChange={(next) => {
              if (!next) {
                setConfig({ ...config, raw: '', ast: null });
                return;
              }
              const expr: any = next;
              if (expr && expr.kind === 'raw_fragment') {
                const text = typeof expr.text === 'string' ? expr.text : '';
                setConfig({ ...config, raw: text, ast: next });
              }
            }}
            registry={registry}
            validation={config.validation}
            disabled={false}
            large
            initialExpanded={initialExpanded}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderTop: '1px solid var(--line)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: '60%' }}>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 11, color: raw ? 'var(--text)' : 'var(--muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {raw || 'No expression defined yet.'}
            </div>
            {hasSweeps && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 999,
                border: '1px solid var(--link)', color: 'var(--link)',
                backgroundColor: 'rgba(14, 165, 233, 0.1)', whiteSpace: 'nowrap',
              }}>
                {sweepCount} permutations
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" onClick={onClose}>Cancel</button>
            <button
              className="button primary"
              onClick={handleSave}
              disabled={!canSave}
              title={canSave
                ? (hasSweeps ? `Save — will expand to ${sweepCount} expression variants` : undefined)
                : 'Enter an expression first'}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
