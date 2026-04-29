import { useState } from 'react'
import { X } from 'lucide-react'
import ExpressionEditorModal from './ExpressionEditorModal'

// ── Types ──────────────────────────────────────────────────────────────────

export type ColumnDef = { name: string; expression: string }

type SavedLayout = {
  layout_id: string
  name: string
  columns: ColumnDef[]
}

interface ColumnLayoutModalProps {
  /** The columns currently active in the screener — working copy. */
  initialColumns: ColumnDef[]
  /** All saved layouts fetched from the backend. */
  savedLayouts: SavedLayout[]
  /** Called when the user clicks OK — applies without saving. */
  onApply: (columns: ColumnDef[]) => void
  /** Called when the user saves a layout. The parent should add it to savedLayouts. */
  onSave: (layout: SavedLayout) => void
  onClose: () => void
}

/**
 * Modal for editing the active column set.
 *
 * Structure:
 *   - Dropdown of saved layouts (selecting one loads it as the working set)
 *   - Working column list: each row shows name + expression + remove button
 *   - "Add Column" → opens ExpressionEditorModal(kind='column') at z-3000
 *   - "Set as Default" → PUT /api/screener/preferences
 *   - Footer: OK (apply without save) | Save As (name + save + apply)
 */
export default function ColumnLayoutModal({
  initialColumns,
  savedLayouts,
  onApply,
  onSave,
  onClose,
}: ColumnLayoutModalProps) {
  const [working, setWorking] = useState<ColumnDef[]>(initialColumns)
  const [showColBuilder, setShowColBuilder] = useState(false)
  const [editingColIndex, setEditingColIndex] = useState<number | null>(null)

  // Save-as state
  const [saveAsMode, setSaveAsMode] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Default status
  const [settingDefault, setSettingDefault] = useState(false)

  // ── Load a saved layout into the working set ──
  function loadLayout(layout_id: string) {
    if (!layout_id) return
    const found = savedLayouts.find(l => l.layout_id === layout_id)
    if (found) setWorking(found.columns.map(c => ({ ...c })))
  }

  // ── Column operations ──
  function removeColumn(i: number) {
    setWorking(prev => prev.filter((_, idx) => idx !== i))
  }

  function openAddColumn() {
    setEditingColIndex(null)
    setShowColBuilder(true)
  }

  function openEditColumn(i: number) {
    setEditingColIndex(i)
    setShowColBuilder(true)
  }

  function handleColBuilderSave(expression: string, name: string) {
    if (editingColIndex !== null) {
      setWorking(prev => prev.map((c, i) => i === editingColIndex ? { name, expression } : c))
    } else {
      setWorking(prev => [...prev, { name, expression }])
    }
    setShowColBuilder(false)
    setEditingColIndex(null)
  }

  // ── Save As ──
  async function handleSaveAs() {
    const name = saveAsName.trim()
    if (!name) { setSaveError('Name is required'); return }
    setSaveLoading(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/screener/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, columns: working }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const created: SavedLayout = await res.json()
      onSave(created)
      onApply(working)
      onClose()
    } catch (e: any) {
      setSaveError(e?.message || String(e))
    } finally {
      setSaveLoading(false)
    }
  }

  // ── Set as default ──
  async function handleSetDefault(layout_id: string) {
    setSettingDefault(true)
    try {
      await fetch('/api/screener/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_column_layout_id: layout_id }),
      })
    } catch {
      // best-effort; not worth blocking the user over
    } finally {
      setSettingDefault(false)
    }
  }

  const editingCol = editingColIndex !== null ? working[editingColIndex] : null

  return (
    <>
      {/* ── Main modal ── */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          zIndex: 2000, display: 'flex', alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          className="card"
          style={{ width: 560, maxWidth: '95vw', height: '70vh', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Edit Columns</h3>
            <button className="button ghost" onClick={onClose} aria-label="Close" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4, minWidth: 28, minHeight: 28 }}><X size={16} aria-hidden /></button>
          </div>

          {/* Load saved layout row */}
          {savedLayouts.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Load saved layout</span>
              <select
                className="select"
                style={{ flex: 1, minWidth: 140 }}
                defaultValue=""
                onChange={e => loadLayout(e.target.value)}
              >
                <option value="">— select —</option>
                {savedLayouts.map(l => (
                  <option key={l.layout_id} value={l.layout_id}>{l.name}</option>
                ))}
              </select>
              {savedLayouts.length > 0 && (
                <button
                  className="button ghost"
                  disabled={settingDefault}
                  style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                  onClick={async () => {
                    // Set whichever layout currently matches working, if any
                    const match = savedLayouts.find(l =>
                      JSON.stringify(l.columns) === JSON.stringify(working)
                    )
                    if (match) await handleSetDefault(match.layout_id)
                  }}
                  title="Save the currently-loaded layout as the page default"
                >
                  {settingDefault ? 'Saving…' : 'Set as default'}
                </button>
              )}
            </div>
          )}

          {/* Working column list */}
          <div style={{ flex: '1 1 0', minHeight: 200, overflow: 'auto', padding: '12px 16px' }}>
            {working.length === 0 ? (
              <div className="hint">No columns configured. Add one below.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {working.map((col, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: 'var(--panel2)', borderRadius: 6 }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, minWidth: 80 }}>{col.name || <em style={{ color: 'var(--muted)' }}>unnamed</em>}</span>
                    <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.expression || '—'}
                    </span>
                    <button className="button ghost" onClick={() => openEditColumn(i)} style={{ fontSize: 12, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      Edit
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => removeColumn(i)}
                      style={{ color: 'var(--muted)', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove"
                      aria-label="Remove column"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add column */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button className="button ghost" onClick={openAddColumn} style={{ fontSize: 12 }}>
              + Add column
            </button>
          </div>

          {/* Save As section */}
          {saveAsMode && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="input"
                placeholder="Layout name…"
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                style={{ flex: 1, minWidth: 140 }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveAs() }}
              />
              <button className="button primary" onClick={handleSaveAs} disabled={saveLoading} style={{ whiteSpace: 'nowrap' }}>
                {saveLoading ? 'Saving…' : 'Save'}
              </button>
              <button className="button ghost" onClick={() => { setSaveAsMode(false); setSaveError(null) }}>Cancel</button>
              {saveError && <span style={{ color: 'var(--err)', fontSize: 12 }}>{saveError}</span>}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button className="button ghost" onClick={() => setSaveAsMode(true)} style={{ marginRight: 'auto' }}>
              Save As…
            </button>
            <button className="button" onClick={onClose}>Cancel</button>
            <button className="button primary" onClick={() => { onApply(working); onClose() }}>
              OK
            </button>
          </div>
        </div>
      </div>

      {/* ── Column expression builder (nested, higher z-index) ── */}
      {showColBuilder && (
        <div style={{ zIndex: 3000, position: 'fixed', inset: 0 }}>
          <ExpressionEditorModal
            kind="column"
            initialExpression={editingCol?.expression}
            initialName={editingCol?.name}
            onSaveColumn={handleColBuilderSave}
            onClose={() => { setShowColBuilder(false); setEditingColIndex(null) }}
          />
        </div>
      )}
    </>
  )
}
