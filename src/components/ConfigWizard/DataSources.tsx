import { useEffect } from 'react'
import Info from '../ui/Info'

export default function DataSources({
  ohlcVersion, setOhlcVersion,
  errors, setErrors
}:{
  ohlcVersion: string
  setOhlcVersion: (v:string)=>void
  errors: Record<string,string|undefined>
  setErrors: (e:Record<string,string|undefined>)=>void
}){
  useEffect(()=>{
    const e = { ...errors }
    e.ohlc = ohlcVersion.trim() ? undefined : 'Required'
    setErrors(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ohlcVersion])

  return (
    <div className="card stack">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2 style={{margin:0}}>Data Sources</h2>
        <Info text={"Select which OHLC dataset version to use. This must match your provider/cache.\nKey: data_versions.ohlc"} />
      </div>
      <div className="kv">
        <div className="label">
          OHLC version <Info text={"Example: v1. Required by Preloader."} />
          <span className="hint">Config.data_versions.ohlc</span>
        </div>
        <div>
          <input className="input" value={ohlcVersion} onChange={e=>setOhlcVersion(e.target.value)} placeholder="v1" />
          {errors.ohlc && <div className="err">{errors.ohlc}</div>}
        </div>
      </div>
    </div>
  )
}
