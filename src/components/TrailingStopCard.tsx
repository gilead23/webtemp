import { useState } from 'react'

/**
 * Trailing stop configuration card for the Exit & Stops step.
 *
 * Supports sweepable params matching the backend TrailingStopSpec:
 *   trail (float), mode (enum), hwm_field (enum), sigma_n (int)
 *
 * Each param emits a ParamSpec-compatible structure:
 *   { values: [...] } | { range: { start, stop, step } }
 *
 * The parent merges this into config JSON as trade_management.trailing_stop.
 */

export type TrailingStopParams = {
  trail: ParamValue
  mode: ParamValue
  hwm_field: ParamValue
  sigma_n: ParamValue
}

type ParamValue = any[] // always stored as array of values for sweep compatibility

type Props = {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  params: TrailingStopParams
  onChange: (params: TrailingStopParams) => void
}

const DEFAULTS: TrailingStopParams = {
  trail: [0.05],
  mode: ['pct'],
  hwm_field: ['Close'],
  sigma_n: [20],
}

export function getDefaultTrailingStopParams(): TrailingStopParams {
  return { ...DEFAULTS }
}

const MODE_OPTIONS = ['pct', 'abs', 'sigma']
const HWM_OPTIONS = ['Close', 'High']

export default function TrailingStopCard({ enabled, onToggle, params, onChange }: Props) {
  const hasSigma = Array.isArray(params.mode) && params.mode.includes('sigma')

  const update = (key: keyof TrailingStopParams, val: any[]) => {
    onChange({ ...params, [key]: val })
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text)' }}>Trailing Stop</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
          <ToggleSwitch checked={enabled} onChange={onToggle} />
        </label>
      </div>

      {enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          {/* Trail */}
          <ParamRow
            label="Trail"
            help="Trail distance from high-water mark"
            value={params.trail}
            onChange={v => update('trail', v)}
            type="number"
            step={0.01}
          />

          {/* Mode */}
          <ParamRow
            label="Mode"
            help="pct = percentage, abs = dollar, sigma = volatility-scaled"
            value={params.mode}
            onChange={v => update('mode', v)}
            type="enum"
            options={MODE_OPTIONS}
          />

          {/* HWM Field */}
          <ParamRow
            label="HWM Field"
            help="Price field for high-water mark tracking"
            value={params.hwm_field}
            onChange={v => update('hwm_field', v)}
            type="enum"
            options={HWM_OPTIONS}
          />

          {/* Sigma N — only visible when sigma mode is included */}
          {hasSigma && (
            <ParamRow
              label="Sigma N"
              help="Lookback periods for sigma calculation"
              value={params.sigma_n}
              onChange={v => update('sigma_n', v)}
              type="number"
              step={1}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* === Sub-components === */

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? 'var(--ok)' : 'var(--panel2)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        background: 'var(--fg)',
        position: 'absolute', top: 2,
        left: checked ? 18 : 2,
        transition: 'left 0.15s',
      }} />
    </div>
  )
}

function ParamRow({ label, help, value, onChange, type, options, step }: {
  label: string
  help: string
  value: any[]
  onChange: (v: any[]) => void
  type: 'number' | 'enum'
  options?: string[]
  step?: number
}) {
  const [inputMode, setInputMode] = useState<'single' | 'list'>('single')
  const displayVal = Array.isArray(value) ? value : [value]

  return (
    <div style={paramRowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <button
          onClick={() => {
            const next = inputMode === 'single' ? 'list' : 'single'
            setInputMode(next)
            if (next === 'single' && displayVal.length > 1) {
              onChange([displayVal[0]])
            }
          }}
          style={modeBtnStyle}
          title={inputMode === 'single' ? 'Switch to sweep list' : 'Switch to single value'}
        >
          {inputMode === 'single' ? '1' : '[ ]'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{help}</div>

      {type === 'enum' ? (
        inputMode === 'single' ? (
          <select
            className="select"
            value={displayVal[0] ?? ''}
            onChange={e => onChange([e.target.value])}
            style={inputStyle}
          >
            {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(options || []).map(o => {
              const sel = displayVal.includes(o)
              return (
                <button
                  key={o}
                  onClick={() => {
                    if (sel) onChange(displayVal.filter(x => x !== o))
                    else onChange([...displayVal, o])
                  }}
                  style={{
                    ...chipStyle,
                    background: sel ? 'rgba(96,165,250,0.2)' : 'transparent',
                    borderColor: sel ? 'var(--link)' : 'var(--line)',
                    color: sel ? 'var(--link)' : 'var(--muted)',
                  }}
                >{o}</button>
              )
            })}
          </div>
        )
      ) : (
        inputMode === 'single' ? (
          <input
            className="input"
            type="number"
            step={step}
            value={displayVal[0] ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? '' : Number(e.target.value)
              onChange([v])
            }}
            style={inputStyle}
          />
        ) : (
          <input
            className="input"
            type="text"
            value={displayVal.join(', ')}
            onChange={e => {
              const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              const nums = parts.map(Number).filter(n => !isNaN(n))
              onChange(nums.length > 0 ? nums : [])
            }}
            placeholder="comma-separated values"
            style={inputStyle}
          />
        )
      )}
    </div>
  )
}

/* === Styles === */

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--panel), var(--panel2))',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: 16,
}

const paramRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const inputStyle: React.CSSProperties = {
  height: 32,
  fontSize: 13,
  width: '100%',
}

const modeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 4,
  color: 'var(--muted)',
  fontSize: 10,
  padding: '1px 6px',
  cursor: 'pointer',
  fontFamily: 'monospace',
}

const chipStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 12,
  cursor: 'pointer',
  background: 'transparent',
}
