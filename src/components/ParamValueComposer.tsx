import { useEffect, useMemo, useState } from 'react'

export type ParamMeta = {
  kind?: 'integer'|'float'|'number'|'percent'|'string'|'boolean'
  min?: number
  max?: number
  step?: number
  choices?: string[]
  required?: boolean
  default?: any
}

export type ParamState =
  | { mode: 'single'; value: any }
  | { mode: 'list'; values: any[] }
  | { mode: 'range'; start: number; end: number; step?: number }

function coerce(kind: ParamMeta['kind'], v: any){
  if (kind === 'boolean') return !!v
  if (kind === 'integer') {
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : NaN
  }
  if (kind === 'float' || kind === 'number' || kind === 'percent'){
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  return v
}

function expandFromState(kind: ParamMeta['kind'], st: ParamState): any[] {
  if (st.mode === 'single') return (st.value === '' || st.value === undefined) ? [] : [st.value]
  if (st.mode === 'list')   return [...st.values]
  if (st.mode === 'range'){
    const s = Number(st.start), e = Number(st.end)
    const step = st.step && Number(st.step) !== 0 ? Math.abs(Number(st.step)) : 1
    if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(step)) return []
    const asc = e >= s
    const out: number[] = []
    if (asc){
      for (let x = s; x <= e + 1e-12; x += step) out.push(kind==='integer' ? Math.trunc(x) : x)
    } else {
      for (let x = s; x >= e - 1e-12; x -= step) out.push(kind==='integer' ? Math.trunc(x) : x)
    }
    return out
  }
  return []
}

function validateValues(meta: ParamMeta, arr: any[]): string | null {
  const { kind, min, max, choices, required } = meta || {}
  if (required && arr.length === 0) return 'at least one value required'

  if (choices && choices.length){
    for (const v of arr){
      if (!choices.includes(String(v))) return `invalid choice: ${v}`
    }
    return null
  }

  if (kind === 'integer' || kind === 'float' || kind === 'number' || kind === 'percent'){
    for (const v of arr){
      const n = Number(v)
      if (!Number.isFinite(n)) return `non-numeric value: ${v}`
      if (min !== undefined && n < min) return `value < min (${min})`
      if (max !== undefined && n > max) return `value > max (${max})`
      if (kind === 'integer' && !Number.isInteger(n)) return `integer required: ${v}`
    }
  }
  return null
}

export default function ParamValueComposer({
  name,
  meta,
  initial,
  onPreview,
  disabled = false,
  dense = false,
}:{
  name: string
  meta?: ParamMeta
  initial?: ParamState
  onPreview?: (st: ParamState, arr: any[], valid: boolean, error?: string) => void
  disabled?: boolean
  dense?: boolean
}){
  const kind = meta?.kind

  const defaultForSingle = useMemo(()=>{
    if (initial && initial.mode === 'single') return initial.value
    if (meta && meta.default !== undefined && meta.default !== null) {
      return meta.choices?.length ? String(meta.default) : meta.default
    }
    if (meta?.choices && meta.choices.length) return meta.choices[0]
    return ''
  }, [initial, meta])

  const [mode, setMode] = useState<ParamState['mode']>(initial?.mode ?? 'single')

  const [single, setSingle] = useState<any>(
    (initial && initial.mode==='single')
      ? initial.value
      : defaultForSingle
  )

  const [listVals, setListVals] = useState<string>(
    initial && initial.mode==='list' ? initial.values.join(', ') : ''
  )

  const [rangeStart, setRangeStart] = useState<any>(
    initial && initial.mode==='range' ? initial.start : ''
  )
  const [rangeEnd, setRangeEnd] = useState<any>(
    initial && initial.mode==='range' ? initial.end : ''
  )
  const [rangeStep, setRangeStep] = useState<any>(
    initial && initial.mode==='range' ? (initial.step ?? meta?.step ?? 1) : (meta?.step ?? 1)
  )

  const state: ParamState = useMemo(()=>{
    if (mode === 'single') return { mode, value: (kind ? coerce(kind, single) : single) }
    if (mode === 'list') {
      const raw = listVals.split(',').map(s=>s.trim()).filter(s=>s.length>0)
      const coerced = raw.map(v => kind ? coerce(kind, v) : v)
      return { mode, values: coerced }
    }
    const s = kind ? coerce(kind, rangeStart) : rangeStart
    const e = kind ? coerce(kind, rangeEnd) : rangeEnd
    const st = Number(rangeStep)
    return { mode, start: s, end: e, step: st }
  }, [mode, single, listVals, rangeStart, rangeEnd, rangeStep, kind])

  const expanded = useMemo(()=>expandFromState(kind, state), [state, kind])
  const error = useMemo(()=>validateValues(meta || {}, expanded), [meta, expanded])
  const valid = !error

  useEffect(()=>{
    onPreview?.(state, expanded, valid, error || undefined)
  }, [state, expanded, valid, error, onPreview])

  const isNumericKind = kind === 'integer' || kind === 'float' || kind === 'number' || kind === 'percent'
  const disabledStyle = disabled ? { opacity: 0.6, pointerEvents: 'none' as const } : undefined
  const badgeBaseStyle = dense ? { fontSize: '0.75rem', padding: '2px 6px' } : undefined


  return (
    <div className="stack" style={{gap: (dense ? 4 : 12), ...(disabledStyle||{})}}>
      <div className="row" style={{gap: (dense ? 6 : 12), flexWrap: dense ? 'wrap' : undefined}}>
        <label className="row"><input type="radio" checked={mode==='single'} onChange={()=>setMode('single')} disabled={disabled}/>Single</label>
        <label className="row"><input type="radio" checked={mode==='list'} onChange={()=>setMode('list')} disabled={disabled}/>List</label>
        <label className="row"><input type="radio" checked={mode==='range'} onChange={()=>setMode('range')} disabled={disabled}/>Range</label>
      </div>

      {mode === 'single' && (
        meta?.choices?.length ? (
          <select className="select" value={String(single)} onChange={e=>setSingle(e.target.value)} disabled={disabled}>
            {meta.choices.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input
            className="input"
            type={isNumericKind ? 'number' : 'text'}
            step={isNumericKind ? (meta?.step ?? 'any') : undefined}
            min={isNumericKind && meta?.min !== undefined ? meta.min : undefined}
            max={isNumericKind && meta?.max !== undefined ? meta.max : undefined}
            value={single}
            onChange={e=>setSingle(e.target.value)}
            placeholder={isNumericKind ? 'value' : 'value'}
            disabled={disabled}
          />
        )
      )}

      {mode === 'list' && (
        <div className="stack" style={{...(disabledStyle||{}), gap: dense ? 4 : 8}}>
          <div className="hint">
            {meta?.choices?.length
              ? `Comma-separated choices. Allowed: ${meta.choices.slice(0,6).join(', ')}${meta.choices.length>6?'…':''}`
              : `Comma-separated ${isNumericKind ? 'numbers' : 'values'}`
            }
          </div>
          <input
            className="input"
            type="text"
            value={listVals}
            onChange={e=>setListVals(e.target.value)}
            placeholder={isNumericKind ? 'e.g. 1, 2.5, 3' : 'e.g. A, B, C'}
            disabled={disabled}
          />
        </div>
      )}

      {mode === 'range' && (
        <div className="row" style={{gap: (dense ? 4 : 8), flexWrap:'wrap', ...(disabledStyle||{})}}>
          <input
            className="input"
            style={{flex:1, minWidth:0}}
            type="number"
            step={meta?.step ?? 'any'}
            value={rangeStart}
            onChange={e=>setRangeStart(e.target.value)}
            placeholder="start"
            disabled={disabled}
          />
          <input
            className="input"
            style={{flex:1, minWidth:0}}
            type="number"
            step={meta?.step ?? 'any'}
            value={rangeEnd}
            onChange={e=>setRangeEnd(e.target.value)}
            placeholder="end"
            disabled={disabled}
          />
          <input
            className="input"
            style={{flex:1, minWidth:0}}
            type="number"
            step="any"
            value={rangeStep}
            onChange={e=>setRangeStep(e.target.value)}
            placeholder={`step (${meta?.step ?? 1})`}
            disabled={disabled}
          />
        </div>
      )}

      <div className="row" style={{gap: (dense ? 3 : 8), alignItems:'center', flexWrap:'wrap', ...(disabledStyle||{})}}>
        <span className="badge" style={badgeBaseStyle}>preview count: {expanded.length}</span>
        {valid ? (
          <span className="badge" style={{ ...(badgeBaseStyle || {}), background:'color-mix(in oklab, var(--ok) 22%, transparent)'}}>valid</span>
        ) : (
          <span className="badge" style={{ ...(badgeBaseStyle || {}), background:'color-mix(in oklab, var(--err) 22%, transparent)'}}>invalid: {error}</span>
        )}
        {!dense && expanded.length > 0 && (
          <div className="row" style={{gap:4, flexWrap:'wrap'}}>
            {expanded.slice(0,12).map((v,i)=>(
              <span key={i} className="chip">{String(v)}</span>
            ))}
            {expanded.length > 12 && <span className="hint">…+{expanded.length-12} more</span>}
          </div>
        )}
      </div>
    </div>
  )
}