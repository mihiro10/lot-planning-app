import React, { useState, useEffect, useCallback } from 'react'
import { getChangeLog } from '../api'

const s = {
  wrap:     { flex: 1, overflow: 'auto', background: '#fff', padding: 16 },
  toolbar:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' },
  input:    { padding: '5px 8px', border: '1px solid #ccc', borderRadius: 5, fontSize: 12 },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:       { textAlign: 'left', fontWeight: 600, color: '#666', background: '#fafafa', padding: '6px 10px', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td:       { textAlign: 'left', padding: '5px 10px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' },
  disappearRow: { background: '#FDEEDD' },
  arrow:    { color: '#aaa', margin: '0 5px' },
  oldVal:   { color: '#999', textDecoration: 'line-through' },
  newVal:   { fontWeight: 700 },
  gone:     { color: '#c0392b', fontWeight: 700 },
  tag:      { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9, background: '#FDEEDD', color: '#8a5a1e', marginLeft: 6 },
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function fmt(v) { return v === null || v === undefined ? '（空）' : v }

export default function ChangeLogScreen({ defaultRange }) {
  const [start, setStart] = useState(defaultRange?.start ? addDays(todayISO(), -7) : addDays(todayISO(), -7))
  const [end, setEnd]     = useState(todayISO())
  const [q, setQ]         = useState('')
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!start || !end) return
    setLoading(true)
    try {
      const data = await getChangeLog(start, end, q || undefined)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [start, end, q])

  useEffect(() => { load() }, [load])

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <b>変更履歴</b>
        <input style={s.input} type="date" value={start} onChange={e => setStart(e.target.value)} />
        〜
        <input style={s.input} type="date" value={end} onChange={e => setEnd(e.target.value)} />
        <input style={s.input} placeholder="品目名で絞り込み" value={q} onChange={e => setQ(e.target.value)} />
        {loading && <span style={{ color: '#888' }}>読み込み中...</span>}
        <span style={{ color: '#888' }}>{rows.length}件</span>
      </div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>変更日時</th>
            <th style={s.th}>品目名</th>
            <th style={s.th}>行</th>
            <th style={s.th}>対象日</th>
            <th style={s.th}>変化</th>
            <th style={s.th}>編集者</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={r.new_value === null ? s.disappearRow : undefined}>
              <td style={s.td}>{r.changed_at ? new Date(r.changed_at).toLocaleString('ja-JP') : ''}</td>
              <td style={s.td}>{r.product_name}</td>
              <td style={s.td}>{r.row_type_name}</td>
              <td style={s.td}>{r.date}</td>
              <td style={s.td}>
                <span style={s.oldVal}>{fmt(r.old_value)}</span>
                <span style={s.arrow}>→</span>
                <span style={r.new_value === null ? s.gone : s.newVal}>{fmt(r.new_value)}</span>
                {r.new_value === null && <span style={s.tag}>消えた</span>}
              </td>
              <td style={s.td}>{r.editor || '（不明）'}</td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#999' }}>この期間の変更はありません</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
