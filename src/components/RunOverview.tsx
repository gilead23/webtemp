export default function RunOverview({stats}:{stats:{running:number;done:number;pruned:number;failed:number}}){
  return (
    <div style={{display:'flex', gap:16}}>
      <div>RUNNING: {stats.running}</div>
      <div>DONE: {stats.done}</div>
      <div>PRUNED: {stats.pruned}</div>
      <div>FAILED: {stats.failed}</div>
    </div>
  )
}
