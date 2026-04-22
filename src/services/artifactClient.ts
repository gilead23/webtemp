// artifactClient.ts — canonical client (includes getPermutations + getRunHeader)
const API_BASE = '/api';

export type ListedRun = {
  id: string;
  path: string;
  has_run_json: boolean;
  has_summary_csv: boolean;
  has_resume_json: boolean;
  has_manifest_jsonl: boolean;
  valid: boolean;
  created_at?: string;
  status?: string;
  total_permutations?: number;
  test_name?: string;
  // Server-computed summary metrics (eliminates N+1 getSummary calls)
  done_perms?: number;
  best_sharpe?: number | null;
  best_return?: number | null;
  best_per_day_return?: number | null;
  best_profit_factor?: number | null;
};

export type Permutation = {
  perm_id: string;
  entry: { label: string; name?: string; params: Record<string, any> }[];
  exit:  { label: string; name?: string; params: Record<string, any> }[];
};

export type Study = {
  study_id: string;
  name: string;
  description: string;
  created_at: string;
  run_count?: number;
};

export type StudyRun = {
  id: string;
  test_name: string | null;
  created_at: string | null;
  has_summary_csv: boolean;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  total_perms: number | null;
  done_perms: number;
  best_sharpe: number | null;
  best_return: number | null;
  best_per_day_return: number | null;
  best_profit_factor: number | null;
};

export type StudyBests = {
  best_sharpe: number | null;
  best_sharpe_run: string | null;
  best_return: number | null;
  best_per_day_return: number | null;
  best_profit_factor: number | null;
  best_pf_run: string | null;
};

export type StudyDetail = Study & {
  runs: StudyRun[];
  study_bests: StudyBests;
};

export const artifactClient = {
  async listRuns(): Promise<ListedRun[]> {
    const r = await fetch(`${API_BASE}/runs`);
    if (!r.ok) throw new Error('listRuns failed');
    return await r.json();
  },

  async getHeader(runId: string): Promise<any> {
    const r = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/header`);
    if (!r.ok) throw new Error('getHeader failed');
    return await r.json();
  },

  async getRunHeader(runId: string): Promise<any> {
    // Alias for existing callers (runStore.ts)
    return this.getHeader(runId);
  },

  async getSummary(runId: string): Promise<any[]> {
    const r = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/summary`);
    if (!r.ok) throw new Error('getSummary failed');
    return await r.json();
  },

  async getResume(runId: string): Promise<any> {
    const r = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/resume`);
    if (!r.ok) throw new Error('getResume failed');
    return await r.json();
  },


  async deleteRun(runId: string): Promise<void> {
    const r = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(msg || 'deleteRun failed');
    }
  },

  async getPermutations(runId: string): Promise<Permutation[]> {
    const r = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/permutations`);
    if (!r.ok) throw new Error('getPermutations failed');
    return await r.json();
  },

  async promotePermutation(runId: string, permId: string, name: string, description: string): Promise<any> {
    const r = await fetch(`${API_BASE}/active/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, perm_id: permId, name, description }),
    })
    if (!r.ok) {
      const msg = await r.text().catch(() => '')
      throw new Error(msg || 'promotePermutation failed')
    }
    return await r.json()
  },

  // ── Study API ──

  async listStudies(): Promise<Study[]> {
    const r = await fetch(`${API_BASE}/studies`);
    if (!r.ok) throw new Error('listStudies failed');
    return await r.json();
  },

  async createStudy(name: string, description: string = ''): Promise<Study> {
    const r = await fetch(`${API_BASE}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!r.ok) throw new Error('createStudy failed');
    return await r.json();
  },

  async getStudy(studyId: string): Promise<StudyDetail> {
    const r = await fetch(`${API_BASE}/studies/${encodeURIComponent(studyId)}`);
    if (!r.ok) throw new Error('getStudy failed');
    return await r.json();
  },

  async updateStudy(studyId: string, updates: { name?: string; description?: string }): Promise<any> {
    const r = await fetch(`${API_BASE}/studies/${encodeURIComponent(studyId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!r.ok) throw new Error('updateStudy failed');
    return await r.json();
  },

  async deleteStudy(studyId: string): Promise<void> {
    const r = await fetch(`${API_BASE}/studies/${encodeURIComponent(studyId)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('deleteStudy failed');
  },

  async moveRunToStudy(studyId: string, runId: string): Promise<any> {
    const r = await fetch(`${API_BASE}/studies/${encodeURIComponent(studyId)}/runs/${encodeURIComponent(runId)}`, {
      method: 'POST',
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(msg || 'moveRunToStudy failed');
    }
    return await r.json();
  },

  async removeRunFromStudy(studyId: string, runId: string): Promise<any> {
    const r = await fetch(`${API_BASE}/studies/${encodeURIComponent(studyId)}/runs/${encodeURIComponent(runId)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(msg || 'removeRunFromStudy failed');
    }
    return await r.json();
  },
};

export function toNum(x: any): number {
  if (x == null) return NaN;
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    const s = x.trim().replace(/%$/, '');
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }
  return NaN;
}
