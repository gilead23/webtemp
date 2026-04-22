import Info from '../ui/Info'

export type ValidateConfig = {
  walk_forward_window?: number
  walk_forward_step?: number
  folds?: number
}

export default function RunSettings({
  runId, setRunId,
  mode, setMode,
  validateCfg, setValidateCfg,
  errors, setErrors,
  showAdv, setShowAdv,
}:{
  runId: string
  setRunId: (v:string)=>void
  mode: 'backtest' | 'validate'
  setMode: (v:'backtest'|'validate')=>void
  validateCfg: ValidateConfig
  setValidateCfg: (v:ValidateConfig)=>void
  errors: Record<string,string|undefined>
  setErrors: (e:Record<string,string|undefined>)=>void
  showAdv: boolean
  setShowAdv: (v:boolean)=>void
}){
  // validate core fields
  const e: Record<string,string|undefined> = { ...errors }
  // Run name: just needs to be non-empty, 1-200 chars. Any characters allowed.
  e.runId = (runId.trim().length >= 1 && runId.trim().length <= 200) ? undefined : 'Name is required (1–200 chars)'
  e.mode  = (mode === 'backtest' || mode === 'validate') ? undefined : 'Choose a mode'
  if (mode === 'validate'){
    const w = validateCfg.walk_forward_window ?? 0
    const s = validateCfg.walk_forward_step ?? 0
    const f = validateCfg.folds ?? 0
    e.wfw = (w > 0 && Number.isInteger(w)) ? undefined : 'integer > 0'
    e.wfs = (s > 0 && Number.isInteger(s)) ? undefined : 'integer > 0'
    e.wff = (f > 0 && Number.isInteger(f)) ? undefined : 'integer > 0'
  } else {
    e.wfw = e.wfs = e.wff = undefined
  }
  if (JSON.stringify(errors) !== JSON.stringify(e)) setErrors(e)

  return (
    <div className="card stack">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Run Settings</h2>
        <Info text={"Overall run metadata.\n- Run name is a human-friendly label for this sweep.\n- Mode='backtest' runs once across the interval.\n- Mode='validate' performs walk-forward evaluation (configure in Advanced)."} />
      </div>

      <div className="kv">
        <div className="label">
          Run name <Info text={"Human-friendly name for this run. Any characters allowed. A filesystem-safe directory ID is generated automatically."} />
          <span className="hint">Default provided, you can edit</span>
        </div>
        <div>
          <input
            className="input"
            value={runId}
            onChange={e=>setRunId(e.target.value)}
            placeholder="My AEAD5+PEAD5 earnings drift scan"
          />
          {errors.runId && <div className="err">{errors.runId}</div>}
        </div>
      </div>

      <div className="kv">
        <div className="label">
          Mode <Info text={"Backtest: single pass.\nValidate: rolling windows via walk_forward settings (see Advanced)."} />
          <span className="hint">Backtest or Validate (walk-forward)</span>
        </div>
        <div className="row" style={{gap:16}}>
          <label className="row"><input type="radio" name="mode" checked={mode==='backtest'} onChange={()=>setMode('backtest')} />Backtest</label>
          <label className="row"><input type="radio" name="mode" checked={mode==='validate'} onChange={()=>setMode('validate')} />Validate</label>
          <button className="button ghost" onClick={()=>setShowAdv(!showAdv)}>{showAdv ? 'Hide Advanced' : 'Advanced…'}</button>
        </div>
      </div>
      {errors.mode && <div className="err">{errors.mode}</div>}
    </div>
  )
}
