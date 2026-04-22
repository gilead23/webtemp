import { useEffect, useState } from 'react'
import { Tooltip } from '../ui/Tooltip'
import { fetchStrategies, StrategyDef } from '../../services/registryClient'

export default function EntryStep(){
  const [defs, setDefs] = useState<StrategyDef[]>([])
  useEffect(()=>{ fetchStrategies().then(setDefs).catch(()=>setDefs([])) },[])
  return (
    <div>
      <h2>Entry Strategies</h2>
      <ul>
        {defs.map(s => (
          <li key={s.name} style={{marginBottom:12}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <strong>{s.label || s.name}</strong>
              {s.description && <Tooltip content={s.description}>ⓘ</Tooltip>}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:8, marginTop:6}}>
              {s.params.map(p => (
                <label key={p.name} style={{display:'contents'}}>
                  <span>{p.name} {p.help && <Tooltip content={p.help}>?</Tooltip>}</span>
                  {(p.choices && p.choices.length>0) ? (
                    <select defaultValue={p.default ?? ''}>
                      {p.choices.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input defaultValue={String(p.default ?? '')}/>
                  )}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
