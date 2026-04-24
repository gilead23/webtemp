import { useState } from 'react'

export function Tooltip({ children, content }:{children:React.ReactNode, content:React.ReactNode}){
  const [open,setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}>
      <span className="underline decoration-dotted cursor-help" tabIndex={0} aria-label="info">{children}</span>
      {open && (
        <div role="tooltip" style={{position:'absolute', zIndex:50, marginTop:8, maxWidth:320, padding:8, borderRadius:6, background:'var(--panel2)', color:'var(--fg)', border:'1px solid var(--line)', fontSize:12}}>
          {content}
        </div>
      )}
    </span>
  )
}
