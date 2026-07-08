import React, { useState, useMemo, useCallback } from 'react'
import { updateValuesBatch } from '../api'

const s = {
  wrap:     { flex: 1, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' },
  toolbar:  { display: 'flex', alignItems: 'center', gap: 10, padding: 12, fontSize: 12, borderBottom: '1px solid #eee', flexWrap: 'wrap' },
  input:    { padding: '5px 8px', border: '1px solid #ccc', borderRadius: 5, fontSize: 12 },
  select:   { padding: '5px 8px', border: '1px solid #ccc', borderRadius: 5, fontSize: 12 },
  btn:      { padding: '7px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  progress: { fontSize: 12, color: '#666' },
  chips:    { display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid #eee', flexWrap: 'wrap', minHeight: 16 },
  chip:     { fontSize: 11, background: '#E3F2FD', color: '#1565C0', padding: '3px 9px', borderRadius: 10, cursor: 'pointer', border: 'none' },
  body:     { flex: 1, display: 'flex', overflow: 'hidden' },
  panel:    { width: 190, flexShrink: 0, borderRight: '1px solid #eee', background: '#fafafa', overflowY: 'auto', padding: '8px 0' },
  facetGroup: { padding: '6px 12px 10px', borderBottom: '1px solid #eee' },
  facetTitle: { fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 },
  facetOpt:   { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#444', padding: '2px 0', cursor: 'pointer' },
  facetCnt:   { color: '#aaa', marginLeft: 'auto' },
  results:  { flex: 1, overflow: 'auto' },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:       { textAlign: 'right', fontWeight: 600, color: '#666', background: '#fafafa', padding: '6px 10px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td:       { textAlign: 'right', padding: '4px 10px', borderBottom: '1px solid #eee' },
  numInput: { width: 80, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, textAlign: 'right' },
  catHeader: { background: '#EEF3FB', color: '#1565C0', fontWeight: 700, padding: '6px 10px', fontSize: 11.5, textAlign: 'left' },
}

const FACETS = [
  { key: 'status',       label: '状態',             single: true,  get: p => p.status ? [p.status] : [] },
  { key: 'category',     label: '分類',             single: true,  get: p => p.category ? [p.category] : [] },
  { key: 'planner',      label: '計画担当',          single: false, get: p => p.planner || [] },
  { key: 'mfg_location', label: '製造場所',          single: false, get: p => p.mfg_location || [] },
  { key: 'storage',      label: '保管場所（最終入庫場所）', single: true, get: p => p.storage ? [p.storage] : [] },
]

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function BulkEntryScreen({ products, rowTypes, onApplied }) {
  const [date, setDate] = useState(todayISO())
  const [mode, setMode] = useState('inbound')  // 'inbound' | 'outbound'
  const [selected, setSelected] = useState({})  // facetKey -> Set(values)
  const [inputs, setInputs] = useState({})      // "productId:rowTypeId" -> string
  const [dirty, setDirty] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedTick, setSavedTick] = useState(0)

  const inboundRt  = useMemo(() => rowTypes.find(rt => rt.role === 'inbound_actual'), [rowTypes])
  const outboundRts = useMemo(() => rowTypes.filter(rt => rt.role === 'demand_actual'), [rowTypes])
  const activeRts = mode === 'inbound' ? (inboundRt ? [inboundRt] : []) : outboundRts

  const toggleFacetValue = (facetKey, value) => {
    setSelected(prev => {
      const next = { ...prev }
      const set = new Set(next[facetKey] || [])
      if (set.has(value)) set.delete(value); else set.add(value)
      if (set.size === 0) delete next[facetKey]; else next[facetKey] = set
      return next
    })
  }

  const facetOptions = useMemo(() => {
    return FACETS.map(f => {
      const counts = new Map()
      for (const p of products) {
        for (const v of f.get(p)) counts.set(v, (counts.get(v) || 0) + 1)
      }
      return { ...f, options: [...counts.entries()].sort((a, b) => b[1] - a[1]) }
    })
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      for (const f of FACETS) {
        const sel = selected[f.key]
        if (!sel || sel.size === 0) continue
        const vals = f.get(p)
        if (!vals.some(v => sel.has(v))) return false
      }
      return true
    })
  }, [products, selected])

  // If exactly one facet has 2+ selections, group the result list under that
  // facet's headers so multi-picks (e.g. two categories) stay distinguishable.
  const groupFacetKey = useMemo(() => {
    const multi = FACETS.filter(f => (selected[f.key]?.size || 0) >= 2)
    return multi.length === 1 ? multi[0].key : null
  }, [selected])

  const groupFacet = FACETS.find(f => f.key === groupFacetKey)
  const groups = useMemo(() => {
    if (!groupFacet) return [{ label: null, items: filteredProducts }]
    const sel = selected[groupFacet.key]
    const byValue = new Map([...sel].map(v => [v, []]))
    for (const p of filteredProducts) {
      for (const v of groupFacet.get(p)) {
        if (byValue.has(v)) byValue.get(v).push(p)
      }
    }
    return [...byValue.entries()].map(([label, items]) => ({ label, items }))
  }, [groupFacet, selected, filteredProducts])

  // Flat row order (group headers excluded) so arrow keys can jump between
  // cells the same way Excel does — up/down move rows, left/right move
  // columns, only crossing a cell boundary once the text cursor is already
  // at that edge so mid-number editing isn't interrupted.
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups])
  const rowIndexOf = useMemo(() => new Map(flatItems.map((p, i) => [p.id, i])), [flatItems])

  const cellId = (rowIdx, colIdx) => `be-cell-${rowIdx}-${colIdx}`

  const focusCell = (rowIdx, colIdx) => {
    if (rowIdx < 0 || rowIdx >= flatItems.length || colIdx < 0 || colIdx >= activeRts.length) return
    const el = document.getElementById(cellId(rowIdx, colIdx))
    if (!el) return
    // Safari (unlike Chrome) doesn't reliably auto-scroll a programmatically
    // focused element into view, so after enough Enter/arrow presses the
    // focus quietly moves off-screen and it looks like nothing happened.
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.focus()
    el.select()
  }

  const onCellKeyDown = (e, rowIdx, colIdx) => {
    // A composing IME's own Enter confirms the input's text, not our
    // navigation — let that happen uninterrupted rather than fighting it.
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') {
      // Enter has no default action to fight here, but without an explicit
      // move the input just sits there focused (or blurs) — moving down a
      // row matches Excel/Sheets and means a following arrow key always has
      // something focused to act on, instead of falling through to the
      // browser's own scroll-the-page behavior.
      e.preventDefault()
      focusCell(rowIdx + 1, colIdx)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()  // also stops the native number-input spinner increment
      focusCell(rowIdx + (e.key === 'ArrowDown' ? 1 : -1), colIdx)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const input = e.target
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0
      const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length
      if (e.key === 'ArrowLeft' && atStart) {
        e.preventDefault()
        focusCell(rowIdx, colIdx - 1)
      } else if (e.key === 'ArrowRight' && atEnd) {
        e.preventDefault()
        focusCell(rowIdx, colIdx + 1)
      }
    }
  }

  const getValue = useCallback((pid, rtid) => {
    const key = `${pid}:${rtid}`
    if (key in inputs) return inputs[key]
    const p = products.find(pr => pr.id === pid)
    const v = p?.values?.[String(rtid)]?.[date]
    return v === null || v === undefined ? '' : String(v)
  }, [inputs, products, date])

  const setValue = (pid, rtid, val) => {
    const key = `${pid}:${rtid}`
    setInputs(prev => ({ ...prev, [key]: val }))
    setDirty(prev => new Set(prev).add(key))
  }

  const onDateOrModeChange = (nextDate, nextMode) => {
    setDate(nextDate)
    setMode(nextMode)
    setInputs({})
    setDirty(new Set())
  }

  const handleSubmit = async () => {
    const updates = [...dirty].map(key => {
      const [pidStr, rtidStr] = key.split(':')
      const raw = inputs[key]
      const num = raw === '' ? null : Number(raw)
      return { product_id: Number(pidStr), row_type_id: Number(rtidStr), date, value: (num === null || Number.isNaN(num)) ? null : num }
    })
    if (!updates.length) return
    setSubmitting(true)
    setError('')
    try {
      await updateValuesBatch(updates)
      setDirty(new Set())
      setSavedTick(t => t + 1)
      onApplied?.()
    } catch (e) {
      setError(e.response?.data?.detail || '保存に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <b>一括入力</b>
        <input style={s.input} type="date" value={date} onChange={e => onDateOrModeChange(e.target.value, mode)} />
        <select style={s.select} value={mode} onChange={e => onDateOrModeChange(date, e.target.value)}>
          <option value="inbound">入庫</option>
          <option value="outbound">出荷（{outboundRts.length}先まとめて）</option>
        </select>
        <span style={s.progress}>{filteredProducts.length}件が条件に一致{dirty.size > 0 ? ` / ${dirty.size}件未保存` : ''}</span>
        {savedTick > 0 && dirty.size === 0 && <span style={{ color: '#0f8a7a', fontSize: 11 }}>✓ 保存済み</span>}
        <div style={{ flex: 1 }} />
        <button style={{ ...s.btn, background: '#1565C0', color: '#fff' }} disabled={submitting || dirty.size === 0} onClick={handleSubmit}>
          {submitting ? '適用中...' : '適用'}
        </button>
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 12, padding: '6px 12px' }}>{error}</div>}

      <div style={s.chips}>
        {FACETS.flatMap(f => [...(selected[f.key] || [])].map(v => (
          <button key={`${f.key}:${v}`} style={s.chip} onClick={() => toggleFacetValue(f.key, v)}>
            {f.label}: {v} ✕
          </button>
        )))}
      </div>

      <div style={s.body}>
        <div style={s.panel}>
          {facetOptions.map(f => (
            <div key={f.key} style={s.facetGroup}>
              <div style={s.facetTitle}>{f.label}</div>
              {f.options.map(([value, count]) => (
                <label key={value} style={s.facetOpt}>
                  <input
                    type="checkbox"
                    checked={selected[f.key]?.has(value) || false}
                    onChange={() => toggleFacetValue(f.key, value)}
                  />
                  {value}
                  <span style={s.facetCnt}>{count}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <div style={s.results}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, textAlign: 'left' }}>品目名</th>
                {activeRts.map(rt => <th key={rt.id} style={s.th}>{rt.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => (
                <React.Fragment key={g.label ?? gi}>
                  {g.label && (
                    <tr><td colSpan={1 + activeRts.length} style={s.catHeader}>{g.label} ({g.items.length}件)</td></tr>
                  )}
                  {g.items.map(p => {
                    const rowIdx = rowIndexOf.get(p.id)
                    return (
                      <tr key={p.id}>
                        <td style={{ ...s.td, textAlign: 'left' }}>{p.name}</td>
                        {activeRts.map((rt, colIdx) => (
                          <td key={rt.id} style={s.td}>
                            <input
                              id={cellId(rowIdx, colIdx)}
                              style={s.numInput}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={getValue(p.id, rt.id)}
                              onChange={e => setValue(p.id, rt.id, e.target.value)}
                              onKeyDown={e => onCellKeyDown(e, rowIdx, colIdx)}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
              {!filteredProducts.length && (
                <tr><td colSpan={1 + activeRts.length} style={{ ...s.td, textAlign: 'center', color: '#999' }}>条件に一致する品目がありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
