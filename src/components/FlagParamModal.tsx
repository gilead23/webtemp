import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import {
  FlagDefinition,
  ParamDefinition,
  UiFlagInstance,
  UiParamSpec,
} from '../types/flags';
import { ParamEditor } from './ParamEditor';
import { ExpressionFlagCard } from './ExpressionFlagCard';
import type { ExpressionFlagConfig } from '../types/expression';
import type { ExpressionRegistry } from '../types/expression_registry';
import { fetchExpressionRegistry } from '../services/expressionRegistryClient';

const DEFAULT_EXPRESSION_REGISTRY: ExpressionRegistry = {
  functions: [],
  binaryOps: [
    { op: '>', label: '>', leftKinds: ['series'], rightKinds: ['number'] },
    { op: '>=', label: '>=', leftKinds: ['series'], rightKinds: ['number'] },
    { op: '<', label: '<', leftKinds: ['series'], rightKinds: ['number'] },
    { op: '<=', label: '<=', leftKinds: ['series'], rightKinds: ['number'] },
    {
      op: '==',
      label: '==',
      leftKinds: ['series', 'number', 'bool'],
      rightKinds: ['series', 'number', 'bool'],
    },
  ],
};

interface FlagParamModalProps {
  isOpen: boolean;
  kind: 'entry' | 'exit';
  flagDefinitions: FlagDefinition[];
  initialFlag: UiFlagInstance | null;
  onCancel(): void;
  onSave(flag: UiFlagInstance): void;
}

// ── Inline styles ──
// This project does NOT use Tailwind (no tailwindcss dependency, no postcss
// config). Every component uses inline styles or the project's own CSS classes
// (card, stack, button, hint, etc.).  The previous version of this component
// used Tailwind utility classes which rendered as no-ops, causing the modal to
// appear as unstyled inline HTML instead of a proper overlay.
//
// These styles match the dark theme used by ExpressionBuilder's param popup
// and ExpressionEditorModal's overlay — same colors, same border treatments,
// same font sizes.

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.55)',
  overflow: 'hidden',
};

const cardStyle: CSSProperties = {
  width: 900,
  maxWidth: '95vw',
  height: '80vh',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  border: '1px solid var(--line)',
  backgroundColor: 'var(--panel)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
  color: 'var(--fg)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid var(--line)',
  flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--fg)',
  margin: 0,
};

const closeBtnStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flex: '1 1 0',
  minHeight: 0,
  overflow: 'hidden',
};

const leftPaneStyle: CSSProperties = {
  width: 280,
  borderRight: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const searchBoxStyle: CSSProperties = {
  padding: 8,
  borderBottom: '1px solid var(--line)',
};

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid var(--line)',
  backgroundColor: 'var(--bg)',
  color: 'var(--fg)',
  outline: 'none',
  boxSizing: 'border-box',
};

const flagListStyle: CSSProperties = {
  flex: '1 1 0',
  overflowY: 'auto',
  fontSize: 11,
};

const flagItemStyle = (active: boolean): CSSProperties => ({
  width: '100%',
  textAlign: 'left' as const,
  padding: '6px 10px',
  border: 'none',
  borderBottom: '1px solid var(--line)',
  cursor: 'pointer',
  backgroundColor: active ? 'color-mix(in oklab, var(--link) 55%, var(--panel))' : 'transparent',
  color: active ? 'var(--fg)' : 'var(--fg)',
  fontSize: 11,
  display: 'block',
});

const flagItemCategoryStyle: CSSProperties = {
  fontSize: 9,
  color: 'var(--muted)',
  marginTop: 1,
};

const rightPaneStyle: CSSProperties = {
  flex: '1 1 0',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  minWidth: 0,
};

const defHeaderStyle: CSSProperties = {
  borderBottom: '1px solid var(--line)',
  padding: '10px 14px',
  flexShrink: 0,
};

const defLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fg)',
};

const defDescStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--muted)',
  marginTop: 4,
  lineHeight: 1.4,
};

const paramGridStyle: CSSProperties = {
  flex: '1 1 0',
  overflowY: 'auto',
  padding: '10px 14px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  alignContent: 'start',
};

const paramColumnStyle: CSSProperties = {
  flex: '1 1 0',
  overflowY: 'auto',
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const paramCardItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 10px',
  borderRadius: 6,
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--line)',
  fontSize: 11,
};

const paramNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--link)',
};

const paramDescriptionStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--muted)',
  lineHeight: 1.3,
};

const emptyRightPaneStyle: CSSProperties = {
  flex: '1 1 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--muted)',
  fontSize: 11,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '10px 16px',
  borderTop: '1px solid var(--line)',
  flexShrink: 0,
};

const cancelBtnStyle: CSSProperties = {
  fontSize: 11,
  borderRadius: 999,
  padding: '5px 14px',
  border: '1px solid var(--line)',
  backgroundColor: 'var(--panel2)',
  color: 'var(--fg)',
  cursor: 'pointer',
};

const saveBtnStyle = (enabled: boolean): CSSProperties => ({
  fontSize: 11,
  borderRadius: 999,
  padding: '5px 14px',
  border: '1px solid var(--link)',
  backgroundColor: enabled ? 'var(--link)' : 'var(--panel2)',
  color: enabled ? 'var(--bg)' : 'var(--muted)',
  cursor: enabled ? 'pointer' : 'default',
  opacity: enabled ? 1 : 0.5,
});

export const FlagParamModal: React.FC<FlagParamModalProps> = ({
  isOpen,
  kind,
  flagDefinitions,
  initialFlag,
  onCancel,
  onSave,
}) => {
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(
    initialFlag?.name ?? null
  );
  const [paramSpecs, setParamSpecs] = useState<Record<string, UiParamSpec>>(
    initialFlag?.params ?? {}
  );

  // ── Sync state when modal opens or initialFlag changes ──
  // useState initializers only run on first mount. Since this component is
  // always mounted in NewSweep (isOpen toggles visibility), we must reset
  // selectedName and paramSpecs whenever the modal is opened with a
  // (possibly new) initialFlag.  Without this, editing an existing flag
  // shows stale state (null selectedName → empty right pane instead of the
  // flag's config panel with pre-populated params).
  useEffect(() => {
    if (!isOpen) return;
    if (initialFlag) {
      setSelectedName(initialFlag.name);
      setParamSpecs(initialFlag.params);
      setSearch('');
    } else {
      setSelectedName(null);
      setParamSpecs({});
      setSearch('');
    }
  }, [isOpen, initialFlag]);

  const [expressionRegistry, setExpressionRegistry] = useState<ExpressionRegistry>(
    DEFAULT_EXPRESSION_REGISTRY,
  );

  // Fetch expression registry only when the modal is actually opened.
  // This component is always mounted in NewSweep (isOpen toggles
  // visibility), so a bare [] dep would fire on page load even though
  // the modal isn't visible.  The cached promise in
  // expressionRegistryClient ensures at most one network request.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    fetchExpressionRegistry()
      .then((reg) => {
        if (!cancelled) {
          setExpressionRegistry(reg);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[FlagParamModal] failed to load expression registry', err);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onCancel]);

  const filteredDefs = useMemo(
    () =>
      flagDefinitions.filter((def) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          def.label.toLowerCase().includes(q) ||
          def.name.toLowerCase().includes(q) ||
          (def.category && def.category.toLowerCase().includes(q))
        );
      }),
    [flagDefinitions, search]
  );

  const selectedDef = useMemo(
    () => flagDefinitions.find((d) => d.name === selectedName) ?? null,
    [flagDefinitions, selectedName]
  );

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[FlagParamModal] selected flag changed', {
      selectedName,
      selectedDefName: selectedDef?.name,
      selectedDefLabel: selectedDef?.label,
      selectedDefParams: selectedDef?.params?.map((p) => p.name),
    });
  }, [selectedName, selectedDef]);

  const handleSelectDef = (name: string) => {
    setSelectedName(name);
    const def = flagDefinitions.find((d) => d.name === name);
    if (!def) return;
    const initial: Record<string, UiParamSpec> = {};
    for (const p of def.params) {
      initial[p.name] = defaultUiSpecForParam(p);
    }
    if (initialFlag?.name === name) {
      setParamSpecs(initialFlag.params);
    } else {
      setParamSpecs(initial);
    }
  };

  const handleParamChange = (paramName: string, spec: UiParamSpec) => {
    setParamSpecs((prev) => ({ ...prev, [paramName]: spec }));
  };

  const handleSaveClick = () => {
    if (!selectedDef) return;
    const id = initialFlag?.id ?? crypto.randomUUID();
    const newFlag: UiFlagInstance = {
      id,
      label: selectedDef.label,
      name: selectedDef.name,
      title: selectedDef.label,
      description: selectedDef.description,
      params: paramSpecs,
    };
    onSave(newFlag);
  };

  if (!isOpen) return null;

  const paramCount = selectedDef?.params?.length ?? 0;
  const useGrid = paramCount >= 4;

  return (
    <div
      style={overlayStyle}
      onClick={onCancel}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Dark theme for ParamEditor inputs inside this modal */}
      <style>{`
        .flag-modal-dark input[type="text"],
        .flag-modal-dark input[type="number"],
        .flag-modal-dark select {
          background-color: var(--panel) !important;
          color: var(--fg) !important;
          border: 1px solid var(--line) !important;
          border-radius: 4px !important;
        }
        .flag-modal-dark input[type="text"]:focus,
        .flag-modal-dark input[type="number"]:focus,
        .flag-modal-dark select:focus {
          border-color: var(--link) !important;
          outline: none !important;
        }
        .flag-modal-dark span {
          color: var(--muted) !important;
        }
        .flag-modal-dark label {
          color: var(--muted) !important;
        }
      `}</style>
      <div
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={headerTitleStyle}>
            {initialFlag ? 'Edit' : 'Add'} {kind === 'entry' ? 'Entry' : 'Exit'} Flag
          </h2>
          <button
            type="button"
            style={closeBtnStyle}
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Body: left flag list + right config pane */}
        <div style={bodyStyle}>
          {/* Left pane: search + flag list */}
          <div style={leftPaneStyle}>
            <div style={searchBoxStyle}>
              <input
                type="text"
                style={searchInputStyle}
                placeholder="Search flags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={flagListStyle}>
              {filteredDefs.map((def) => {
                const active = def.name === selectedName;
                return (
                  <button
                    key={def.name}
                    type="button"
                    onClick={() => handleSelectDef(def.name)}
                    style={flagItemStyle(active)}
                  >
                    <div style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {def.label}
                    </div>
                    {def.category && (
                      <div style={flagItemCategoryStyle}>
                        {def.category}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right pane: flag config */}
          <div style={rightPaneStyle}>
            {selectedDef ? (
              <>
                <div style={defHeaderStyle}>
                  <div style={defLabelStyle}>{selectedDef.label}</div>
                  {selectedDef.description && (
                    <div style={defDescStyle}>
                      {selectedDef.description}
                    </div>
                  )}
                </div>
                <div style={useGrid ? paramGridStyle : paramColumnStyle}>
                  {selectedDef.params.length === 0 && (
                    <div style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 11 }}>
                      This flag has no configurable parameters.
                    </div>
                  )}
                  {selectedDef.params.map((p) => (
                    <div
                      key={p.name}
                      style={paramCardItemStyle}
                      className="flag-modal-dark"
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={paramNameStyle}>
                          {p.label ?? p.name}
                        </span>
                        {p.dataType && (
                          <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>
                            {p.dataType}
                          </span>
                        )}
                        {p.defaultValue != null && (
                          <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                            = {String(p.defaultValue)}
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <div style={paramDescriptionStyle}>
                          {p.description}
                        </div>
                      )}
                      {(() => {
                        const spec =
                          paramSpecs[p.name] ?? defaultUiSpecForParam(p);

                        const flagLabel =
                          (selectedDef?.label ?? '').toLowerCase();
                        const paramLabel = String(p.label ?? p.name).toLowerCase();

                        const isExpressionParam =
                          p.name === 'expression' ||
                          p.dataType === 'expression' ||
                          paramLabel === 'expression' ||
                          (flagLabel.includes('expression') &&
                            p.dataType === 'string');

                        console.log('[FlagParamModal] param classification', {
                          flagName: selectedDef.name,
                          flagLabel: selectedDef.label,
                          paramName: p.name,
                          paramLabel: p.label,
                          dataType: p.dataType,
                          isExpressionParam,
                        });

                        if (isExpressionParam) {
                          const raw =
                            spec.kind === 'values' && spec.values.length
                              ? String(spec.values[0])
                              : '';

                          console.debug('[FlagParamModal] hydrate expression editor', { raw });

                          const cfg: ExpressionFlagConfig = {
                            ast: raw
                              ? ({ kind: 'raw_fragment', text: raw } as any)
                              : null,
                            raw,
                            mode: 'visual',
                            validation: undefined,
                          };

                          return (
                            <ExpressionFlagCard
                              value={cfg}
                              registry={expressionRegistry}
                              onChange={(next) => {
                                const nextSpec: UiParamSpec = {
                                  kind: 'values',
                                  values: [next.raw],
                                };
                                handleParamChange(p.name, nextSpec);
                              }}
                              disabled={false}
                            />
                          );
                        }

                        return (
                          <ParamEditor
                            def={p}
                            value={spec}
                            onChange={(newSpec) => handleParamChange(p.name, newSpec)}
                          />
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={emptyRightPaneStyle}>
                Select a flag on the left to configure its parameters.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button
            type="button"
            style={cancelBtnStyle}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            style={saveBtnStyle(!!selectedDef)}
            disabled={!selectedDef}
            onClick={handleSaveClick}
          >
            {initialFlag ? 'Save' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  );
};

function defaultUiSpecForParam(def: ParamDefinition): UiParamSpec {
  const mode = def.defaultMode ?? 'value';
  if (mode === 'as_is') {
    return { kind: 'as_is' };
  }
  if (mode === 'range' && def.defaultRange) {
    const { start, stop, step, inclusive } = def.defaultRange;
    return { kind: 'range', start, stop, step, inclusive };
  }
  if (mode === 'log_range' && def.defaultLogRange) {
    const { start, stop, num, inclusive, roundToTick } = def.defaultLogRange;
    return { kind: 'log_range', start, stop, num, inclusive, roundToTick };
  }
  if (def.dataType === 'enum' && def.enumValues?.length) {
    return { kind: 'values', values: [def.enumValues[0].value] };
  }
  if (def.defaultValue !== undefined) {
    return { kind: 'values', values: [def.defaultValue] };
  }
  return { kind: 'as_is' };
}
