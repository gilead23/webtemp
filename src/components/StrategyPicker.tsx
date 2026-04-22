import { useEffect, useMemo, useRef, useState } from 'react'
import ParamEditor from './ParamEditor'
import { ExpressionFlagCard } from './ExpressionFlagCard'
import type { ParamMeta } from './ParamValueComposer'
import type { ExpressionFlagConfig } from '../types/expression'
import type { ExpressionRegistry } from '../types/expression_registry'
import { fetchExpressionRegistry } from '../services/expressionRegistryClient'

type RegistryParam = {
  name?: string
  type?: string
  default?: any
  choices?: string[] | null
  help?: string | null
  meta?: { choices?: string[]; help?: string }
}

type RegistryStrategy = {
  name: string
  label?: string
  description?: string | null
  params?: RegistryParam[]
}

export type SelectedStrategy = {
  name: string
  label: string
  params: Record<string, any[]>
}


const DEFAULT_EXPRESSION_REGISTRY: ExpressionRegistry = {
  fields: [],
  functions: [],
  operators: [],
  flags: [],
  error: null,
};


type ExpressionParamEditorOnChange = (
  pname: string,
  values: any[],
  valid: boolean,
  applied: boolean,
) => void;

function ExpressionStrategyParamEditor({
  pname,
  help,
  defaultValue,
  onChange,
}: {
  pname: string;
  help: string;
  defaultValue: any;
  onChange: ExpressionParamEditorOnChange;
}) {
  const initialRaw =
    defaultValue === undefined || defaultValue === null
      ? ''
      : String(defaultValue);
  const [config, setConfig] = useState<ExpressionFlagConfig>({
    ast: null,
    raw: initialRaw,
    mode: 'visual',
    validation: undefined,
  });

  const [expressionRegistry, setExpressionRegistry] = useState<ExpressionRegistry>(
    DEFAULT_EXPRESSION_REGISTRY,
  );

  useEffect(() => {
    let cancelled = false;

    fetchExpressionRegistry()
      .then((reg) => {
        if (!cancelled) {
          setExpressionRegistry(reg);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[StrategyPicker] failed to load expression registry', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfigChange = (next: ExpressionFlagConfig) => {
    setConfig(next);
    const raw = (next.raw || '').trim();
    const values = raw ? [raw] : [];
    const valid = raw.length > 0;
    const applied = valid;
    onChange(pname, values, valid, applied);
  };

  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <strong>{pname}</strong>
            {help && (
              <span className="hint" title={help}>
                ⓘ
              </span>
            )}
          </div>
        </div>
      </div>
      <ExpressionFlagCard
        value={config}
        registry={expressionRegistry}
        onChange={handleConfigChange}
        disabled={false}
      />
    </div>
  );
}

export default function StrategyPicker({
  title,
  onAdd,
  initialStrategy
}:{
  title: string
  onAdd: (s: SelectedStrategy)=>void
  initialStrategy?: SelectedStrategy
}){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|undefined>(undefined)
  const [registry, setRegistry] = useState<RegistryStrategy[]>([])

  useEffect(() => {
    let abort = false
    async function load(){
      try{
        setLoading(true)
        setError(undefined)
        const res = await fetch('/api/registry/strategies')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const arr: RegistryStrategy[] = Array.isArray(data)
          ? data
          : (Array.isArray((data as any)?.strategies) ? (data as any).strategies : [])
        // Keep description, but we never render it inline—tooltip only.
        const sanitized = arr.map(s => ({
          name: s.name,
          label: s.label || s.name,
          description: (s as any)?.description ?? null,
          params: Array.isArray(s.params) ? s.params : []
        }))
        // Filter base classes if present
        const filtered = sanitized.filter(s => s.name !== 'BaseStrategyFlagV2' && s.name !== 'BaseStrategyFlagsV2')
        if (!abort) setRegistry(filtered)
      }catch(e:any){
        if (!abort) setError(String(e?.message||e))
      }finally{
        if (!abort) setLoading(false)
      }
    }
    load()
    return ()=>{ abort = true }
  }, [])

  const [selName, setSelName] = useState<string>('')
  const __SP_didInit = useRef(false)

  useEffect(() => {
    if (__SP_didInit.current) return
    if (!initialStrategy) return
    if (!registry || registry.length === 0) return

    // Prefill selection + params when editing an existing strategy.
    // IMPORTANT: Expression editor hydrates only on mount, so we must bump resetNonce
    // after paramValues include any expression value.

    const strat = registry.find(s => s.name === initialStrategy.name)
    const stratName = (strat?.name || '').toLowerCase()
    const strategyIsExpression =
      stratName.includes('expression') || stratName === 'expr' || stratName === 'expression'

    let expressionKey: string | null = null
    if (strategyIsExpression && Array.isArray(strat?.params)) {
      for (const p of strat.params) {
        const key = (p?.name || '').toLowerCase()
        const typeLower = (p?.type || '').toLowerCase()
        const helpLower = ((p as any)?.help ?? (p as any)?.meta?.help ?? '').toLowerCase()
        const isExpressionParam =
          key === 'expression' ||
          typeLower.includes('expression') ||
          typeLower.includes('expr') ||
          helpLower.includes('dsl')
        if (isExpressionParam) {
          expressionKey = p?.name || null
          break
        }
      }
    }

    const merged: Record<string, any[]> = { ...(initialStrategy.params || {}) }

    // Ensure expression text is present for expression strategies when editing.
    // The Expression editor reads from paramValues on mount; if the expression param
    // is missing/empty but we have initialStrategy.label, seed it.
    if (expressionKey) {
      const cur = merged[expressionKey]
      const has = Array.isArray(cur) && cur.length > 0 && String(cur[0] ?? '').trim().length > 0
      if (!has && initialStrategy.label) {
        merged[expressionKey] = [initialStrategy.label]
      }
    }

    setSelName(initialStrategy.name)
    setParamValues(merged)

    const keys = Object.keys(merged)
    setApplied(Object.fromEntries(keys.map(k => [k, true])) as Record<string, boolean>)
    setParamValid(Object.fromEntries(keys.map(k => [k, true])) as Record<string, boolean>)

    setResetNonce(n => n + 1)
    __SP_didInit.current = true
  }, [initialStrategy, registry])


  const strategy = useMemo(
    () => registry.find(s => s.name === selName),
    [registry, selName]
  )

  const params = useMemo(()=>{
    return strategy?.params ?? []
  }, [strategy])

  const [paramValues, setParamValues] = useState<Record<string, any[]>>({})
  const [paramValid, setParamValid] = useState<Record<string, boolean>>({})
  const [applied, setApplied] = useState<Record<string, boolean>>({})
  const [resetNonce, setResetNonce] = useState<number>(0)

  function resetParamState(){
    setParamValues({})
    setParamValid({})
    setApplied({})
  }

  function buildCleanParams(): Record<string, any[]> {
    const clean: Record<string, any[]> = {}
    const keys = new Set((params || []).map(p => (p as any)?.name).filter(Boolean) as string[])
    for (const [k, v] of Object.entries(paramValues)){
      if (keys.has(k) && applied[k]){
        if (Array.isArray(v)) clean[k] = v
        else if (v !== undefined && v !== null) clean[k] = [v as any]
      }
    }
    return clean
  }

  const canAdd = useMemo(()=>{
    if (!strategy) return false
    for (const p of (params || [])){
      const key = p.name || ''
      if (!key) continue
      if (paramValid[key] === false) return false
    }
    return true
  }, [strategy, params, paramValid])

  return (
    <div className="card stack" style={{gap:12}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <div className="row" style={{gap:8, alignItems:'baseline'}}>
          <h3 style={{margin:0}}>{title}</h3>
          {loading && <span className="hint">loading…</span>}
          {error && <span className="hint" style={{color:'#fca5a5'}}>error: {error}</span>}
        </div>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <select
            className="select"
            value={selName}
            onChange={e=>{
              __SP_didInit.current = true
              setSelName(e.target.value)
              resetParamState()
              setResetNonce(n => n + 1)
            }}
          >
            <option value="">— select strategy —</option>
            {registry.map(s => (
              <option key={s.name} value={s.name}>{s.label || s.name}</option>
            ))}
          </select>

          {/* Strategy description tooltip (no inline text). Native title-based tooltip. */}
          {strategy?.description && (
            <span
              title={strategy.description}
              aria-label="Strategy description"
              style={{
                cursor:'help',
                userSelect:'none',
                fontSize:14,
                lineHeight:'20px'
              }}
            >
              ⓘ
            </span>
          )}

          <button
            className="button"
            onClick={()=>{
              if (!strategy) return
              onAdd({ name: strategy.name, label: strategy.label || strategy.name, params: buildCleanParams() })
              resetParamState()
            }}
            disabled={!canAdd}
            title={canAdd ? 'Add selected strategy with current parameter selections' : 'Fill valid parameter values first'}
          >
            {initialStrategy ? 'Save' : 'Add'}
          </button>
        </div>
      </div>

      {/* No metadata summary block. */}

      {params.length === 0 && (
        <div className="hint">This strategy has no parameters.</div>
      )}

      {/* Editors — each uses its own tooltip from per-param help. */}
      {params.length > 0 && (
        <div className="paramGrid">
          {(() => {
            let expressionEditorRendered = false;

            return params.map((p, idx) => {
              const key = p.name || `param_${idx}`;
              const label = p.name || `param_${idx}`;
              const choices =
                p.choices && Array.isArray(p.choices)
                  ? p.choices
                  : ((p.meta?.choices || undefined) as string[] | undefined);
              const help = (p.help ?? p.meta?.help ?? '').trim();
              const kind = typeToKind(p.type);
              const meta: ParamMeta = {
                kind,
                choices,
                default: (p as any)?.default,
                required: false,
              };
              const strategyName = (strategy?.name || '').toLowerCase();
              const helpText = help.toLowerCase();
              const keyLower = (key || '').toLowerCase();
              const typeLower = (p.type || '').toLowerCase();
              const strategyIsExpression =
                strategyName.includes('expression') ||
                strategyName === 'expr' ||
                strategyName === 'expression';

              // Expression editor should only be used for expression-style strategies.
              // Do NOT key off help text containing the word "expression" (e.g. MovingAverageFlagV2
              // label help mentions "expression string").
              const isExpressionParam =
                strategyIsExpression &&
                (keyLower === 'expression' ||
                  typeLower.includes('expression') ||
                  typeLower.includes('expr') ||
                  helpText.includes('dsl'));

              console.log('[StrategyPicker] param classification', {
                strategyName: strategy?.name,
                paramKey: key,
                paramType: p.type,
                paramHelp: help,
                kind,
                hasChoices: !!(choices && choices.length),
                isExpressionParam,
              });

              const useExpressionEditor =
                isExpressionParam && !expressionEditorRendered;

              if (useExpressionEditor) {
                expressionEditorRendered = true;
                return (
                  <div key={`${selName}|${resetNonce}|${key}`} style={{ gridColumn: '1 / -1' }}>
                    <ExpressionStrategyParamEditor
                      pname={label}
                      help={help || label}
                      defaultValue={(Array.isArray((paramValues as any)?.[key]) && (paramValues as any)[key].length > 0) ? (paramValues as any)[key][0] : ((p as any)?.default ?? '')}
                      onChange={(pname, values, valid, appliedFlag) => {
                        setParamValues(prev => ({ ...prev, [key]: values }));
                        setParamValid(prev => ({ ...prev, [key]: valid }));
                        setApplied(prev => ({ ...prev, [key]: appliedFlag }));
                      }}
                    />
                  </div>
                );
              }

              return (
                <ParamEditor
                  key={`${selName}|${resetNonce}|${key}`}
                  pname={label}
                  meta={meta}
                  initial={(() => {
                    const existing = (paramValues as any)?.[key]
                    if (Array.isArray(existing) && existing.length > 1) {
                      return { mode: 'list', values: existing }
                    }
                    if (Array.isArray(existing) && existing.length === 1) {
                      return { mode: 'single', value: existing[0] }
                    }
                    return choices && choices.length
                      ? { mode: 'single', value: String((p as any)?.default ?? choices[0]) }
                      : { mode: 'single', value: (p as any)?.default ?? '' }
                  })()}
                  initialApplied={!!(applied as any)?.[key]}
                  initialAppliedValues={Array.isArray((paramValues as any)?.[key]) ? (paramValues as any)[key] : []}
                  tooltip={help || label}
                  dense
                  onChange={(_displayName, values, valid, _state, isApplied) => {
                    setParamValues(prev => ({ ...prev, [key]: values }));
                    setParamValid(prev => ({ ...prev, [key]: valid }));
                    setApplied(prev => ({ ...prev, [key]: isApplied }));
                  }}
                />
              );
            });
          })()}
        </div>
      )}
    </div>
  )
}

function typeToKind(t?: string): ParamMeta['kind']{
  const s = (t || '').toLowerCase()
  if (s.includes('int') || s === 'number') return 'number'
  if (s.includes('float') || s.includes('double')) return 'number'
  if (s.includes('str') || s.includes('text')) return 'string'
  if (s.includes('bool')) return 'boolean'
  if (s.includes('enum') || s.includes('choice')) return 'choice'
  return 'string'
}