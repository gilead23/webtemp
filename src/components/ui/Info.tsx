import { useState } from 'react'

export default function Info({text}:{text:string}){
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}
      style={{position:'relative', display:'inline-flex', alignItems:'center'}}
    >
      <span aria-label="info" style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:16, height:16, borderRadius:999, fontSize:11,
        background:'#1b2230', border:'1px solid #2c3240', color:'#9fb4d8',
        cursor:'help', marginLeft:6
      }}>i</span>
      {open && (
        <div role="tooltip" style={{
          position:'absolute', top:'130%', left:0, zIndex:50,
          background:'#0d1117', border:'1px solid #222832', color:'#dbe6ff',
          padding:'10px 12px', borderRadius:8, width:320, boxShadow:'0 8px 26px rgba(0,0,0,.35)'
        }}>
          <div style={{fontSize:12, lineHeight:1.4, whiteSpace:'pre-wrap'}}>{text}</div>
        </div>
      )}
    </span>
  )
}
