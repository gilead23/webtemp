type Cfg = {
  runId: string
  getCursor: () => string | null
  onDelta: (delta: { cursor?: string, perms?: Record<string, any> }) => void
}

let timer: any = null

export function startPolling(cfg: Cfg){
  stop()
  const poll = async () => {
    const since = cfg.getCursor()
    const url = new URL(`/api/runs/${cfg.runId}/manifest`, location.origin)
    if (since) url.searchParams.set('since', since)
    const r = await fetch(url.toString())
    const j = await r.json()
    cfg.onDelta({ cursor: j.cursor })
    timer = setTimeout(poll, 1000)
  }
  poll()
}

export function stop(){
  if (timer){ clearTimeout(timer); timer = null }
}
