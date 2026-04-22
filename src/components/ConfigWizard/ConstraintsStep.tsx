import { useEffect } from 'react'
import Info from '../ui/Info'

export type PruningCfg = {
  enabled?: boolean
  min_trades?: number
  effective_weight_gate?: number
}

export default function ConstraintsStep({
  pruning, setPruning, errors, setErrors
}:{
  pruning: PruningCfg
  setPruning: (v:PruningCfg)=>void
  errors: Record<string,string|undefined>
  setErrors: (e:Record<string,string|undefined>)=>void
}){
  useEffect(()=>{
    const e = { ...errors }
    if (pruning.enabled){
      if (pruning.min_trades !== undefined && (!Number.isInteger(pruning.min_trades) || pruning.min_trades < 0)){
        e.min_trades = 'integer ≥ 0'
      } else e.min_trades = undefined
      if (pruning.effective_weight_gate !== undefined && !(typeof pruning.effective_weight_gate === 'number')){
        e.ewg = 'number'
      } else e.ewg = undefined
    } else {
      e.min_trades = e.ewg = undefined
    }
    setErrors(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pruning.enabled, pruning.min_trades, pruning.effective_weight_gate])

  return (
    <div className="card stack">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Constraints & Pruning</h2>
        <Info text={"Optional rules that filter or gate results.\n- enabled: turn pruning on/off\n- min_trades: drop summaries with fewer signals\n- effective_weight_gate: block prune if weight is below threshold"} />
      </div>

      <div className="kv">
        <div className="label">Enable pruning <Info text={"If true, pruning rules below are evaluated."} /></div>
        <div className="row" style={{gap:12}}>
          <select className="select"
            value={String(Boolean(pruning.enabled))}
            onChange={e=>setPruning({...pruning, enabled: e.target.value === 'true'})}
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </div>
      </div>

      <div className="row" style={{gap:12}}>
        <label className="label">
          min_trades <Info text={"Minimum number of trades required for a summary row to be considered."} />
          <input className="input" type="number" min={0}
            value={pruning.min_trades ?? ''}
            onChange={e=>setPruning({...pruning, min_trades: e.target.value === '' ? undefined : Number(e.target.value)})}
          />
          {errors.min_trades && <div className="err">{errors.min_trades}</div>}
        </label>

        <label className="label">
          effective_weight_gate <Info text={"If provided, prevents pruning when effective weight is below this numeric threshold."} />
          <input className="input" type="number"
            value={pruning.effective_weight_gate ?? ''}
            onChange={e=>setPruning({...pruning, effective_weight_gate: e.target.value === '' ? undefined : Number(e.target.value)})}
          />
          {errors.ewg && <div className="err">{errors.ewg}</div>}
        </label>
      </div>
    </div>
  )
}
