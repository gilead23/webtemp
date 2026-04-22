import Info from './ui/Info'

export type WalkForwardCfg = {
  window?: number
  step?: number
  folds?: number
}

export type PruningCfg = {
  enabled: boolean
  min_trades?: number
  effective_weight_gate?: number
}

export default function RunAdvancedDrawer({
  open,
  setOpen,
  walkForward,
  setWalkForward,
  sessionsAvail,
  pruning,
  setPruning,
  constraints,
  setConstraints,
  mode,
}:{
  open: boolean
  setOpen: (v:boolean)=>void
  walkForward: WalkForwardCfg
  setWalkForward: (v:WalkForwardCfg)=>void
  sessionsAvail: number
  pruning: PruningCfg
  setPruning: (v:PruningCfg)=>void
  constraints: { max_permutations?: number }
  setConstraints: (v:{ max_permutations?: number })=>void
  mode: 'backtest'|'validate'
}){
  if (!open) return null

  const required = (walkForward.window || 0) + Math.max(0, ((walkForward.folds||0)-1) * (walkForward.step||0))
  const feasible = sessionsAvail >= required

  return (
    <div className="card stack" style={{borderColor:'#334155'}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <h3 style={{margin:0}}>Advanced</h3>
        <button className="button ghost" onClick={()=>setOpen(false)}>Close</button>
      </div>

      {/* Walk-forward */}
      <div className="kv">
        <div className="label">
          Walk-forward
          <Info text={
`Rolling validation over sub-windows of your universe dates.

- Window (W): size of each slice, in trading sessions.
- Step (S): how far to move the window each time.
- Folds (F): how many slices to evaluate.

Feasibility: you need at least W + (F-1)*S sessions between start_date and end_date.

Example:
  start=2025-01-01, end=2025-02-28 (~42 sessions)
  W=20, S=10, F=3 → slices: [1..20], [11..30], [21..40]. Required=40.`} />
          <div className="hint">Only applied when Mode = Validate</div>
        </div>
        <div className="row" style={{gap:8, flexWrap:'wrap', opacity: mode==='validate' ? 1 : 0.6}}>
          <label className="label">
            Window (sessions)
            <input className="input" type="number" min={1}
              value={walkForward.window ?? ''}
              onChange={e=>setWalkForward({...walkForward, window: Number(e.target.value)})}
              disabled={mode!=='validate'}
            />
          </label>
          <label className="label">
            Step (sessions)
            <input className="input" type="number" min={1}
              value={walkForward.step ?? ''}
              onChange={e=>setWalkForward({...walkForward, step: Number(e.target.value)})}
              disabled={mode!=='validate'}
            />
          </label>
          <label className="label">
            Folds
            <input className="input" type="number" min={1}
              value={walkForward.folds ?? ''}
              onChange={e=>setWalkForward({...walkForward, folds: Number(e.target.value)})}
              disabled={mode!=='validate'}
            />
          </label>
        </div>
      </div>

      {mode==='validate' && (
        <div className="row" style={{gap:12, flexWrap:'wrap'}}>
          <span className="badge">available sessions: {sessionsAvail}</span>
          <span className="badge">required: {required}</span>
          <span className="badge" style={{background: feasible ? '#164e3f' : '#5a1f1f'}}>
            {feasible ? 'feasible' : 'not feasible'}
          </span>
        </div>
      )}

      {/* Pruning */}
      <div className="kv">
        <div className="label">
          Pruning
          <Info text={
`Early-stop weak permutations to save compute.

- min_trades: do not consider a permutation until at least this many trades exist.
- effective_weight_gate (0..1): drop permutations below this effectiveness threshold.`} />
          <div className="hint">Use to trim hopeless permutations during the run</div>
        </div>
        <div className="stack" style={{gap:10}}>
          <label className="row" style={{gap:8, alignItems:'center'}}>
            <input
              type="checkbox"
              checked={!!pruning.enabled}
              onChange={e=>setPruning({...pruning, enabled: e.target.checked})}
            />
            Enable pruning
          </label>

          <div className="row" style={{gap:8, flexWrap:'wrap', opacity: pruning.enabled ? 1 : 0.6}}>
            <label className="label">
              min_trades
              <input
                className="input"
                type="number"
                min={0}
                value={pruning.min_trades ?? 0}
                onChange={e=>setPruning({...pruning, min_trades: Math.max(0, Number(e.target.value))})}
                disabled={!pruning.enabled}
              />
            </label>

            <label className="label">
              effective_weight_gate
              <input
                className="input"
                type="number"
                min={0}
                max={1}
                step="any"
                value={pruning.effective_weight_gate ?? 0}
                onChange={e=>{
                  const n = Number(e.target.value)
                  const clamped = isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
                  setPruning({...pruning, effective_weight_gate: clamped})
                }}
                disabled={!pruning.enabled}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Constraints */}
      <div className="kv">
        <div className="label">
          Constraints
          <Info text={
`Global guardrails against runaway combinatorics.

- max_permutations: if total permutations exceed this, the launcher should refuse or ask for confirmation.`} />
          <div className="hint">Cap total combinations before starting</div>
        </div>
        <div className="row" style={{gap:8, flexWrap:'wrap'}}>
          <label className="label">
            max_permutations
            <input
              className="input"
              type="number"
              min={0}
              value={constraints.max_permutations ?? ''}
              onChange={e=>{
                const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                setConstraints({ ...constraints, max_permutations: v })
              }}
              placeholder="(optional)"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
