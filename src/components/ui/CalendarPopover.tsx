import { useMemo, useState } from 'react'

function daysInMonth(year:number, month:number){ // month: 0-11
  return new Date(year, month+1, 0).getDate()
}
function pad(n:number){ return String(n).padStart(2,'0') }
function toYMD(d:Date){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

export default function CalendarPopover({
  value, onPick, onClose
}:{
  value?: string
  onPick: (ymd:string)=>void
  onClose: ()=>void
}){
  const init = (()=>{
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)){
      const [y,m] = value.split('-').map(Number)
      return new Date(y, m-1, 1)
    }
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })()

  const [view, setView] = useState<Date>(init)

  const grid = useMemo(()=>{
    const y = view.getFullYear()
    const m = view.getMonth()
    const firstDow = new Date(y, m, 1).getDay() // 0 Sun..6 Sat
    const dim = daysInMonth(y, m)
    const cells: (string|null)[] = []
    for (let i=0;i<firstDow;i++) cells.push(null)
    for (let d=1; d<=dim; d++) cells.push(`${y}-${pad(m+1)}-${pad(d)}`)
    // fill to 6x7 grid
    while (cells.length % 7 !== 0) cells.push(null)
    while (cells.length < 42) cells.push(null)
    return cells
  }, [view])

  const prevMonth = () => setView(v => new Date(v.getFullYear(), v.getMonth()-1, 1))
  const nextMonth = () => setView(v => new Date(v.getFullYear(), v.getMonth()+1, 1))

  const y = view.getFullYear()
  const m = view.toLocaleString(undefined, { month: 'long' })

  return (
    <div style={{
      position:'absolute', top:'110%', left:0, zIndex:100,
      background:'var(--panel)', color:'var(--fg)',
      border:'1px solid var(--line)', borderRadius:8,
      padding:10, width:260, boxShadow:'0 10px 28px rgba(0,0,0,.4)'
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <button className="button ghost" onClick={prevMonth}>&lt;</button>
        <div style={{fontWeight:600}}>{m} {y}</div>
        <button className="button ghost" onClick={nextMonth}>&gt;</button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, fontSize:12, color:'var(--muted)', marginBottom:4}}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{textAlign:'center'}}>{d}</div>)}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4}}>
        {grid.map((ymd, i) => (
          <button
            key={i}
            className="button"
            style={{height:30, padding:0, opacity: ymd ? 1 : .2}}
            disabled={!ymd}
            onClick={()=>{ if (ymd) { onPick(ymd); onClose() } }}
          >
            {ymd ? Number(ymd.split('-')[2]) : ''}
          </button>
        ))}
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
        <button className="button ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
