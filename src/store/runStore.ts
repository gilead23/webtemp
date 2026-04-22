import { create } from 'zustand'
import { artifactClient } from '../services/artifactClient'
import { startPolling as startPollTransport, stop as stopPoll } from '../transports/poll'

type State = {
  run?: any
  summary: any[]
  perms: Record<string, any>
  manifestCursor: string | null
  loading: boolean
  error?: string
}

type Actions = {
  loadRun: (runId: string) => Promise<void>
  startPolling: (runId: string) => void
  stop: () => void
  connectEvents: (runId: string) => void
}

export const useRunStore = create<State & Actions>((set, get) => ({
  summary: [],
  perms: {},
  manifestCursor: null,
  loading: false,
  async loadRun(runId) {
    set({ loading: true })
    const [run, summary, resume] = await Promise.all([
      artifactClient.getRunHeader(runId),
      artifactClient.getSummary(runId),
      artifactClient.getResume(runId),
    ])
    set({ run, summary, perms: resume.perms || {}, manifestCursor: resume.cursor, loading: false })
  },
  startPolling(runId) {
    startPollTransport({
      runId,
      getCursor: () => get().manifestCursor,
      onDelta: (delta) => {
        set((s) => ({
          summary: s.summary, // placeholder: apply summary deltas if sent
          perms: { ...s.perms, ...(delta.perms || {}) },
          manifestCursor: delta.cursor ?? s.manifestCursor
        }))
      }
    })
  },
  stop() { stopPoll() },
  connectEvents() { /* added later */ },
}))
