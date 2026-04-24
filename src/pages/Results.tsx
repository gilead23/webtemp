import { useEffect, useMemo, useState, Fragment } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { artifactClient, toNum } from '../services/artifactClient'
import Modal from '../components/ui/Modal'

/** ======== DEBUG TRACE HELPERS (deterministic) ======== */
const __RES_TAG = '[Results]'
const __RES_log  = (...args: any[]) => { try { console.log(__RES_TAG, ...args) } catch {}
}
const __RES_warn = (...args: any[]) => { try { console.warn(__RES_TAG, ...args) } catch {}
}
const __RES_err  = (...args: any[]) => { try { console.error(__RES_TAG, ...args) } catch {}
}
/** ===================================================== */

type Row = {
  perm_id: string
  totalTrades: number
  avgDaysOpen: number | null
  avgReturn: number | null
  winRate: number | null
  medianReturn: number | null
  perDayAvg: number | null
  perDayKurt: number | null
  perDayMed: number | null
  perDaySkew: number | null
  perDayStd: number | null
  sharpe: number | null
  profitFactor: number | null
}

type SortKey = keyof Row
type SortDir = 'asc' | 'desc'

export default function Results(){
  const { id } = useParams()
  const [header, setHeader] = useState<any | null>(null)
  const [summary, setSummary] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('avgReturn')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null)
  const [promoteName, setPromoteName] = useState('')
  const [promoteDescription, setPromoteDescription] = useState('')
  const [promoteErr, setPromoteErr] = useState<string | null>(null)
  const [promoting, setPromoting] = useState(false)

  const navigate = useNavigate()

  function requestPromote(perm_id: string){
    setPromoteErr(null)
    setConfirmPromoteId(perm_id)
    setPromoteName('')
    setPromoteDescription('')
    __RES_log('Promote click', { runId: id, perm_id })
  }

  async function confirmPromote(){
    if (!id || !confirmPromoteId) return
    const perm_id = confirmPromoteId
    if (!promoteName.trim()) {
      setPromoteErr('name is required')
      return
    }
    if (!promoteDescription.trim()) {
      setPromoteErr('description is required')
      return
    }
    setPromoting(true)
    setPromoteErr(null)
    __RES_log('Promote confirm start', { runId: id, perm_id })
    try {
      const resp = await artifactClient.promotePermutation(id, perm_id, promoteName.trim(), promoteDescription.trim())
      __RES_log('Promote confirm success', { runId: id, perm_id, resp })
      setConfirmPromoteId(null)
      navigate('/active')
    } catch (e:any) {
      const msg = String(e?.message || e)
      setPromoteErr(msg)
      __RES_err('Promote confirm error', { runId: id, perm_id, msg })
    } finally {
      setPromoting(false)
    }
  }

  useEffect(()=>{
    let alive = true
    if (!id) return
    ;(async () => {
      try {
        __RES_log('Fetch start', { id })
        const [h, s, p] = await Promise.all([
          artifactClient.getHeader(id),
          artifactClient.getSummary(id),
          artifactClient.getPermutations(id),
        ])
        if (!alive) return
        __RES_log('Fetch done', {
          headerHasConfig: !!h?.config,
          headerHasUniverse: !!h?.universe,
          totalSummary: s?.length ?? 0,
          totalPerms: p?.length ?? 0
        })
        setHeader(h); setSummary(s); setPerms(p)
      } catch(e:any){
        __RES_err('Fetch error', e)
        setErr(String(e?.message||e))
      }
    })()
    return ()=>{ alive = false }
  }, [id])

  const permsMap = useMemo(()=>{
    const m = new Map<string, any>()
    for (const p of perms) m.set(String(p.perm_id), p)
    return m
  }, [perms])

  useEffect(()=>{
    const out: Row[] = []
        for (const r of summary){
      const totalTrades = toNum((r as any)?.trades_total);
      out.push({
        perm_id: String((r as any)?.perm_id ?? ''),
        totalTrades,
        avgDaysOpen: toNum((r as any)?.avg_days_open),
        avgReturn: toNum((r as any)?.avg_return),
        winRate: toNum((r as any)?.win_rate),
        medianReturn: toNum((r as any)?.median_return),
        perDayAvg: toNum((r as any)?.per_day_avg),
        perDayKurt: toNum((r as any)?.per_day_kurtosis),
        perDayMed: toNum((r as any)?.per_day_median),
        perDaySkew: toNum((r as any)?.per_day_skew),
        perDayStd: toNum((r as any)?.per_day_std),
        sharpe: toNum((r as any)?.sharpe),
        profitFactor: toNum((r as any)?.profit_factor),
      })
    }
    setRows(out)
  }, [summary])

  const sorted = useMemo(()=>{
    const arr = [...rows]
    arr.sort((a,b)=> compare(a,b,sortKey,sortDir))
    return arr
  }, [rows, sortKey, sortDir])

  function onSort(k: SortKey){
    if (k === sortKey) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  if (!id) return <div style={{padding:16}}>Missing Run ID</div>
  if (err) return <div style={{padding:16, color:'crimson'}}>Error: {err}</div>

  return (
    <div style={{padding:16}}>
      <h1>Results</h1>
      <Header id={id} header={header} totalPerms={header?.total_permutations} />
      <div style={{margin:'12px 0'}}>
        <Heatmap summary={summary} perms={perms} />
      </div>
      <Table
        runId={id}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        permsMap={permsMap}
        expanded={expanded}
        setExpanded={setExpanded}
        header={header}
        onRequestPromote={requestPromote}
        promoting={promoting}
      />

      {confirmPromoteId && (
        <Modal
          title="Promote Permutation"
          onClose={() => { if (!promoting) setConfirmPromoteId(null) }}
          width={520}
        >
          <div style={{ marginBottom: 10 }}>
            Promote permutation <code>{confirmPromoteId}</code> from run <code>{id}</code> into an active strategy?
          </div>
          <div style={{ marginBottom: 12, opacity: 0.9 }}>
            Promotion is explicit and irreversible. Runs are not mutated.
          </div>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
             <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
               <div style={{ fontWeight: 600 }}>Name</div>
               <input
                 value={promoteName}
                 onChange={(e) => setPromoteName(e.target.value)}
                 placeholder="e.g. RSI breakout - small caps"
                 disabled={promoting}
                 style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)' }}
               />
             </label>
             <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
               <div style={{ fontWeight: 600 }}>Description</div>
               <textarea
                 value={promoteDescription}
                 onChange={(e) => setPromoteDescription(e.target.value)}
                 placeholder="What is this strategy and why should I care?"
                 disabled={promoting}
                 rows={3}
                 style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)' }}
               />
             </label>
           </div>
          {promoteErr && <div style={{ color: 'crimson' }}>Error: {promoteErr}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="button ghost" onClick={() => setConfirmPromoteId(null)} disabled={promoting}>Cancel</button>
            <button className="button" onClick={confirmPromote} disabled={promoting}>
              {promoting ? 'Promoting…' : 'Promote'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Header({ id, header, totalPerms }:{ id: string, header: any, totalPerms?: number }){
  const created = typeof header?.created_at === 'string' ? fmtMDY(header.created_at) : '—'
  return (
    <div style={{display:'flex', gap:24, alignItems:'center', flexWrap:'wrap', marginBottom:8}}>
      <div><b>Test:</b> <code>{id}</code></div>
      <div><b>Run Date:</b> {created}</div>
      <div><b>Permutations:</b> {typeof totalPerms==='number' ? totalPerms : '—'}</div>
    </div>
  )
}

function oneLineSetup(p: any): string{
  if (!p) return ''
  const mk = (arr: any[]) => (arr||[]).map((it: any)=>{
    const name = (it.name || it.label || '').replace(/\s+\(V\d+\)/, '')
    const params = it.params || {}
    const keys = Object.keys(params).sort()
    const kv = keys.map(k=>`${k}=${String(params[k])}`).join(', ')
    return kv ? `${name}(${kv})` : name
  }).join(' + ')
  const e = mk(p.entry), x = mk(p.exit)
  if (e && x) return `ENTRY: ${e}  |  EXIT: ${x}`
  if (e) return `ENTRY: ${e}`
  if (x) return `EXIT: ${x}`
  return ''
}

function renderHumanBlock(p: any): string{
  if (!p) return 'No details.'
  const block = (title: string, arr: any[]) => {
    const lines: string[] = [title]
    for (const it of (arr||[])){
      lines.push((it.name||it.label||'').trim())
      const params = it.params || {}
      for (const k of Object.keys(params).sort()) lines.push(`${k}=${String(params[k])}`)
    }
    return lines.join('\n')
  }
  return [block('Entry conditions:', p.entry||[]), '', block('Exit conditions:', p.exit||[])].join('\n')
}

/** ========= DETERMINISTIC: use header.universe only ========= */
function normalizeUniverse(u: any){
  if (!u || typeof u !== 'object') return null
  const out: any = {}
  out.tickers = u.tickers === 'ALL' ? 'ALL'
    : Array.isArray(u.tickers) ? u.tickers.slice()
    : typeof u.tickers === 'string' ? u.tickers.split(',').map((s:string)=>s.trim()).filter(Boolean)
    : 'ALL'
  const toYMD = (v:any) => (typeof v === 'string' ? v.slice(0,10) : undefined)
  const sd = toYMD(u.start_date)
  const ed = toYMD(u.end_date)
  if (!sd || !ed) return null
  out.start_date = sd
  out.end_date = ed
  if (Number.isFinite(Number(u.warmup_days))) out.warmup_days = Number(u.warmup_days)
  return out
}
/** ========================================================== */

function Table({
  runId, rows, sortKey, sortDir, onSort,
  permsMap, expanded, setExpanded, header,
  onRequestPromote, promoting
}:{ runId: string, rows: Row[], sortKey: SortKey, sortDir: SortDir, onSort: (k: SortKey)=>void,
    permsMap: Map<string, any>, expanded: Record<string, boolean>, setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    header: any,
    onRequestPromote: (perm_id: string) => void,
    promoting: boolean }){
  const nav = useNavigate()

  function goTrades(perm_id: string){
    const target = `/trades/${encodeURIComponent(runId)}/${encodeURIComponent(perm_id)}`
    __RES_log('Trades icon click', { runId, perm_id, target })
    nav(target)
  }

  function reseedSweep(perm_id: string){
    const perm = permsMap.get(perm_id) || null
    const uni = normalizeUniverse(header?.universe ?? null) // <-- single source of truth
    __RES_log('Reseed click', {
      perm_id,
      headerHasUniverse: !!header?.universe,
      normalizedUniverse: uni
    })
    if (!uni){
      __RES_err('Reseed aborted: header.universe missing or invalid (requires start_date & end_date).')
      return
    }
    const state = {
      seed: {
        source_run_id: runId,
        permutation: perm ?? null,
        universe: uni,
      }
    }
    __RES_log('Navigate -> /new with state.seed.universe present', state)
    nav('/new', { state })
  }

  return (
    <div style={{fontSize:12, lineHeight:1.2}}>
      <table style={{borderCollapse:'collapse', width:'100%', tableLayout:'fixed'}}>
        <colgroup>
          <col style={{width:'28px'}} />
          <col style={{width:'18%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'7%'}} />
          <col style={{width:'5%'}} />
          <col style={{width:'5%'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'34px'}} />
          <col style={{width:'34px'}} />
        </colgroup>
        <thead>
          <tr>
            <th style={{...th, textAlign:'center'}}>&nbsp;</th>
            <Th label="Perm" k="perm_id" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Trades" k="totalTrades" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Avg Days" k="avgDaysOpen" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Avg Ret" k="avgReturn" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Win %" k="winRate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Med Ret" k="medianReturn" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PD Avg" k="perDayAvg" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PD Kurt." k="perDayKurt" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PD Med." k="perDayMed" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PD Skew" k="perDaySkew" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PD Std" k="perDayStd" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Sharpe" k="sharpe" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="PF" k="profitFactor" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th style={{...th, textAlign:'center'}} title="Trades">TR</th>
            <th style={{...th, textAlign:'center'}} title="New sweep from this perm">➕</th>
            <th style={{...th, textAlign:'center'}} title="Promote to active">PR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const pid = String(r.perm_id)
            const perm = permsMap.get(pid)
            const oneLine = oneLineSetup(perm)
            const open = !!expanded[pid]
            return (
              <Fragment key={pid}>
                <tr>
                  <td style={{...td, width:28, textAlign:'center'}}>
                    <button
                      style={{ width:22, height:22, borderRadius:4, border:'1px solid var(--line)', background:'transparent', color:'inherit', cursor:'pointer', fontWeight:700, fontSize:12, lineHeight:'18px', padding:0 }}
                      onClick={()=> setExpanded(prev=> ({...prev, [pid]: !prev[pid]}))}
                      aria-label="toggle details"
                    >{open ? '−' : '+'}</button>
                  </td>
                  <td style={{...td, textAlign:'left'}} title={oneLine}>
                    <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                      {oneLine || <code>{pid}</code>}
                    </div>
                  </td>
                  <td style={td}>{r.totalTrades}</td>
                  <td style={td}>{fmtFixed(r.avgDaysOpen, 1)}</td>
                  <td style={td}>{fmtPct(r.avgReturn, 2)}</td>
                  <td style={td}>{fmtPct(r.winRate, 2)}</td>
                  <td style={td}>{fmtPct(r.medianReturn, 2)}</td>
                  <td style={td}>{fmtPct(r.perDayAvg, 2)}</td>
                  <td style={td}>{fmtFixed(r.perDayKurt, 2)}</td>
                  <td style={td}>{fmtPct(r.perDayMed, 2)}</td>
                  <td style={td}>{fmtFixed(r.perDaySkew, 2)}</td>
                  <td style={td}>{fmtPct(r.perDayStd, 2)}</td>
                  <td style={td}>{fmtFixed(r.sharpe, 2)}</td>
                  <td style={td}>{fmtFixed(r.profitFactor, 2)}</td>

                  {/* View trades (row-level) — TEXT GLYPH TO AVOID SVG/CSS COLLISIONS */}
                  <td style={{...td, textAlign:'center'}}>
                    <button
                      onClick={()=>goTrades(pid)}
                      onMouseDown={()=>__RES_log('Trades icon mousedown', { runId, perm_id: pid })}
                      onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') __RES_log('Trades icon key', { runId, perm_id: pid, key:e.key }) }}
                      title="View trades for this permutation"
                      style={glyphBtn}
                      aria-label="view trades"
                    >TR</button>
                  </td>

                  {/* Reseed (row-level) — TEXT GLYPH */}
                  <td style={{...td, textAlign:'center'}}>
                    <button
                      onClick={()=>reseedSweep(pid)}
                      onMouseDown={()=>__RES_log('Reseed icon mousedown', { runId, perm_id: pid })}
                      title="Start new sweep from this permutation"
                      style={glyphBtn}
                      aria-label="new sweep from this run’s header.universe"
                    >➕</button>
                  </td>

                  {/* Promote (row-level) — TEXT GLYPH */}
                  <td style={{...td, textAlign:'center'}}>
                    <button
                      onClick={()=>onRequestPromote(pid)}
                      onMouseDown={()=>__RES_log('Promote icon mousedown', { runId, perm_id: pid })}
                      title="Promote this permutation to an active strategy"
                      style={glyphBtn}
                      aria-label="promote permutation"
                      disabled={promoting}
                    >PR</button>
                  </td>
                </tr>

                {open && (
                  <tr>
                    <td style={td} colSpan={17}>
                      <pre style={{ margin:0, whiteSpace:'pre-wrap', background:'var(--panel2)', border:'1px solid var(--line)', borderRadius:8, padding:'8px 10px' }}>
                        {renderHumanBlock(perm)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Heatmap({ summary, perms }:{ summary: any[], perms: any[] }){
  type AxisSide = 'entry' | 'exit'

  type AxisSpec = {
    key: string
    side: AxisSide
    flag: string
    param: string
    label: string
  }

  const axisOptions: AxisSpec[] = useMemo(()=>{
    const m = new Map<string, AxisSpec>()

    const add = (side: AxisSide, it: any) => {
      const fname = (it?.name || it?.label || '').trim()
      if (!fname) return
      const params = it?.params || {}
      for (const k of Object.keys(params)) {
        const key = `${side}|${fname}|${k}`
        if (!m.has(key)){
          const sideLabel = side === 'entry' ? 'Entry' : 'Exit'
          m.set(key, {
            key,
            side,
            flag: fname,
            param: k,
            label: `${sideLabel}: ${fname} · ${k}`,
          })
        }
      }
    }

    for (const p of perms){
      for (const it of (p.entry || [])) add('entry', it)
      for (const it of (p.exit  || [])) add('exit',  it)
    }

    return Array.from(m.values()).sort((a,b)=> a.label.localeCompare(b.label))
  }, [perms])

  const [xKey, setXKey] = useState<string>('')
  const [yKey, setYKey] = useState<string>('')

  useEffect(()=>{
    if (!axisOptions.length){
      setXKey('')
      setYKey('')
      return
    }
    setXKey(prev => axisOptions.some(o => o.key === prev) ? prev : axisOptions[0].key)
    setYKey(prev => {
      if (axisOptions.some(o => o.key === prev)) return prev
      const alt = axisOptions.find(o => o.key !== axisOptions[0].key) || axisOptions[0]
      return alt.key
    })
  }, [axisOptions])

  const axisIndex = useMemo(()=>{
    const m = new Map<string, AxisSpec>()
    for (const spec of axisOptions) m.set(spec.key, spec)
    return m
  }, [axisOptions])

  function getAxisValues(p:any, axisKey:string): string[] {
    if (!axisKey) return []
    const spec = axisIndex.get(axisKey)
    if (!spec) return []

    const source = spec.side === 'entry' ? (p?.entry || []) : (p?.exit || [])
    if (!Array.isArray(source) || !source.length) return []

    const out: string[] = []
    for (const it of source){
      const fname = (it?.name || it?.label || '').trim()
      if (fname !== spec.flag) continue
      if (it?.params && Object.prototype.hasOwnProperty.call(it.params, spec.param)){
        const raw = it.params[spec.param]
        if (raw === null || raw === undefined) continue
        out.push(String(raw))
      }
    }
    return out
  }

  const { xs, ys, grid } = useMemo(()=>{
    const pById = new Map<string, any>()
    for (const p of perms) pById.set(String(p.perm_id), p)

    const xSet = new Set<string>()
    const ySet = new Set<string>()
    const buckets = new Map<string, { sumRet: number, sumTrades: number }>()

    for (const r of summary){
      const pid = String((r as any)?.perm_id ?? '')
      const p = pById.get(pid)
      if (!p) continue

      const xVals = xKey ? getAxisValues(p, xKey) : []
      const yVals = yKey ? getAxisValues(p, yKey) : []
            if (!xVals.length || !yVals.length) continue
      const trades = toNum((r as any)?.trades_total);
      if (!trades) continue

      const avgRet = toNum((r as any)?.avg_return)
      if (avgRet == null || !Number.isFinite(avgRet)) continue

      for (const xv of xVals){
        const xCoord = String(xv)
        xSet.add(xCoord)
        for (const yv of yVals){
          const yCoord = String(yv)
          ySet.add(yCoord)
          const key = `${xCoord}||${yCoord}`
          const prev = buckets.get(key) || { sumRet: 0, sumTrades: 0 }
          prev.sumRet += avgRet * trades
          prev.sumTrades += trades
          buckets.set(key, prev)
        }
      }
    }

    const sortSmart = (arr:string[])=>{
      const nums = arr.map(v => Number(v))
      const allNum = nums.every(n => Number.isFinite(n))
      if (allNum) return [...arr].sort((a,b)=>Number(a)-Number(b))
      return [...arr].sort((a,b)=>a.localeCompare(b))
    }

    const xs = sortSmart(Array.from(xSet))
    const ys = sortSmart(Array.from(ySet))
    const grid = new Map<string, number | null>()

    for (const [key, agg] of buckets){
      if (!agg.sumTrades) grid.set(key, null)
      else grid.set(key, agg.sumRet / agg.sumTrades)
    }

    return { xs, ys, grid }
  }, [summary, perms, xKey, yKey, axisIndex])

  const cellStyle = (val: number|null) => {
    if (val==null || !Number.isFinite(val)) return { background:'var(--panel2)', color:'var(--fg)', padding:'4px 6px' as const }
    const pos = val>0
    return { background: pos ? 'color-mix(in oklab, var(--ok) 30%, var(--panel))' : 'color-mix(in oklab, var(--err) 30%, var(--panel))', color:'var(--fg)', padding:'4px 6px' as const }
  }

  const noCells = xs.length===0 || ys.length===0

  const xLabel = axisIndex.get(xKey)?.label || (xKey || '—')
  const yLabel = axisIndex.get(yKey)?.label || (yKey || '—')

  return (
    <div>
      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
        <label>X&nbsp;
          <select value={xKey} onChange={e=>setXKey(e.target.value)}>
            {axisOptions.map(opt=> <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
        </label>
        <label>Y&nbsp;
          <select value={yKey} onChange={e=>setYKey(e.target.value)}>
            {axisOptions.map(opt=> <option key={opt.key} value={opt.key}>{opt.label}</option>)}
          </select>
        </label>
      </div>

      {noCells ? (
        <div style={{padding:'8px 10px', border:'1px dashed var(--line)', borderRadius:8, fontSize:12, background:'var(--panel2)'}}>
          No heatmap cells to display for <b>{xLabel}</b> vs <b>{yLabel}</b>.
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse', fontSize:12}}>
            <thead>
              <tr>
                <th style={th}></th>
                {xs.map(x=><th key={x} style={th}>{x}</th>)}
              </tr>
            </thead>
            <tbody>
              {ys.map(y => (
                <tr key={y}>
                  <th style={th}>{y}</th>
                  {xs.map(x => {
                    const v = grid.get(`${x}||${y}`) ?? null
                    return <td key={x} style={{...td, ...cellStyle(v)}}>{v==null?'—':fmtPct(v, 2)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
function compare(a: Row, b: Row, key: SortKey, dir: SortDir){
  const sgn = dir==='asc'?1:-1
  const va = a[key], vb = b[key]
  if (['totalTrades','avgDaysOpen','avgReturn','winRate','medianReturn','perDayAvg','perDayKurt','perDayMed','perDaySkew','perDayStd','sharpe'].includes(key as string)){
    const na = typeof va==='number'?va: Number.NEGATIVE_INFINITY
    const nb = typeof vb==='number'?vb: Number.NEGATIVE_INFINITY
    return (na-nb)*sgn
  }
  return String(va??'').localeCompare(String(vb??''))*sgn
}

function fmtFixed(n: number | null, d=2){ return n == null || !Number.isFinite(n) ? '—' : n.toFixed(d) }
function fmtPct(n: number | null, d=2){ return n == null || !Number.isFinite(n) ? '—' : (n*100).toFixed(d)+'%' }

function fmtMDY(s: string): string {
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return s
  const d = new Date(t)
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  const yyyy = d.getFullYear()
  return `${mm}-${dd}-${yyyy}`
}

function Th({ label, k, sortKey, sortDir, onSort }:{ label:string, k: SortKey, sortKey: SortKey, sortDir: SortDir, onSort: (k:SortKey)=>void }){
  const active = k===sortKey
  return <th style={th}><button onClick={()=>onSort(k)} style={thBtn}>{label}{' '}{active?(sortDir==='asc'?'▲':'▼'):'↕'}</button></th>
}

const th: React.CSSProperties = { textAlign:'left', borderBottom:'1px solid var(--line)', padding:'8px 6px' }
const td: React.CSSProperties = { borderBottom:'1px solid var(--line)', padding:'8px 6px', verticalAlign:'top' }
const btn: React.CSSProperties = { display:'inline-block', padding:'6px 10px', border:'1px solid var(--link)', color:'var(--link)', borderRadius:6, textDecoration:'none' }
const btnPrimary: React.CSSProperties = { ...btn, background:'var(--link)', color:'#fff' }

/** Text glyph buttons — guaranteed visible across hostile CSS */
const glyphBtn: React.CSSProperties = {
  width:24,
  height:24,
  display:'inline-flex',
  alignItems:'center',
  justifyContent:'center',
  border:'1px solid var(--line)',
  borderRadius:6,
  background:'transparent',
  cursor:'pointer',
  fontSize:14,
  fontWeight:700,
  lineHeight:1,
  padding:0,
  color:'inherit',
}

/** Sortable table header button */
const thBtn: React.CSSProperties = {
  display:'inline-flex',
  alignItems:'center',
  gap:4,
  padding:0,
  margin:0,
  border:'none',
  background:'transparent',
  font:'inherit',
  cursor:'pointer',
  color:'var(--link)',
}
