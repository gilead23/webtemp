import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import RunOverview from '../components/RunOverview'
import { useRunStore } from '../store/runStore'
import { toNum } from '../services/artifactClient'

export default function Run(){
  const { id } = useParams()
  const navigate = useNavigate()
  const { loadRun, startPolling, stop, run, summary, perms } = useRunStore()
  const [entered, setEntered] = useState('')


  useEffect(()=>{
    if (!id) return
    loadRun(id).then(()=>startPolling(id))
    return () => stop()
  },[id])

  const stats = {running:0, done:0, pruned:0, failed:0}
  Object.values(perms).forEach((p:any)=>{
    if (p.status==='RUNNING') stats.running++
    else if (p.status==='DONE') stats.done++
    else if (p.status==='PRUNED') stats.pruned++
    else if (p.status==='FAILED') stats.failed++
  })

  let bestProfitFactor: number | null = null;
  (summary as any[]).forEach((row)=>{
    const pf = toNum((row as any)?.profit_factor);
    if (Number.isFinite(pf)) {
      bestProfitFactor = (bestProfitFactor == null) ? pf : Math.max(bestProfitFactor, pf);
    }
  });


  if (!id) {
    return (
      <div style={{display:'grid', gap:12}}>
        <h1>Run Monitor</h1>
        <div>
          <input
            placeholder="Enter run id (e.g., backtest_01)"
            value={entered}
            onChange={e=>setEntered(e.target.value)}
            style={{padding:'8px 12px', border:'1px solid #ccc', borderRadius:6, width:320}}
          />
          <button
            onClick={()=> entered && navigate(`/run/${encodeURIComponent(entered)}`)}
            style={{marginLeft:8, padding:'8px 12px', borderRadius:6, border:'1px solid #333', background:'#fff'}}
          >
            Open
          </button>
          <span style={{marginLeft:12, color:'#666'}}>
            or <Link to="/runs">pick from list</Link>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1>Run: {id}</h1>
      <div style={{marginBottom:12}}><Link to="/runs">← Back to Runs</Link></div>
      <RunOverview stats={stats} />
      {Array.isArray(summary) && summary.length > 0 && (
        <div style={{marginTop:12}}>
          <h2>Profit factor by permutation</h2>
          <table style={{borderCollapse:'collapse', width:'100%', maxWidth:600}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'4px 6px', borderBottom:'1px solid #ddd'}}>#</th>
                <th style={{textAlign:'left', padding:'4px 6px', borderBottom:'1px solid #ddd'}}>Profit factor</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row:any, idx:number)=>{
                const pf = toNum((row as any)?.profit_factor);
                return (
                  <tr key={idx}>
                    <td style={{padding:'4px 6px', borderBottom:'1px solid #f0f0f0'}}>{idx+1}</td>
                    <td style={{padding:'4px 6px', borderBottom:'1px solid #f0f0f0'}}>
                      {Number.isFinite(pf) ? pf.toFixed(3) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{marginTop:12}}>Best profit factor: {bestProfitFactor == null ? '—' : bestProfitFactor.toFixed(3)}</div>
      <pre style={{marginTop:16, background:'#f7f7f7', padding:12}}>
        {JSON.stringify({run, count_summary: summary.length}, null, 2)}
      </pre>
    </div>
  )
}
