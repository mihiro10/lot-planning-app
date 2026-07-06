import React, { useState } from 'react'

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  card:    { background: '#fff', borderRadius: 8, padding: 20, width: 360, fontSize: 13 },
  title:   { fontWeight: 700, marginBottom: 14, fontSize: 15 },
  row:     { marginBottom: 12 },
  label:   { display: 'block', fontSize: 11, color: '#666', marginBottom: 4 },
  input:   { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 5, fontSize: 13 },
  pair:    { display: 'flex', gap: 10 },
  half:    { flex: 1 },
  err:     { color: '#c62828', fontSize: 11, marginTop: -6, marginBottom: 10 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  btn:     { padding: '7px 16px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13 },
}

const initial = { name: '', code: '', category: '', lot_size: 1, lead_time: 0, min_stock: 0, max_stock: 0 }

export default function AddProductModal({ onClose, onCreate }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('品目名を入力してください'); return }
    setSaving(true)
    setError('')
    try {
      await onCreate({
        ...form,
        name:      form.name.trim(),
        lot_size:  Number(form.lot_size)  || 1,
        lead_time: Number(form.lead_time) || 0,
        min_stock: Number(form.min_stock) || 0,
        max_stock: Number(form.max_stock) || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={e => e.stopPropagation()}>
        <div style={s.title}>品目を追加</div>

        <div style={s.row}>
          <label style={s.label}>品目名（必須）</label>
          <input style={s.input} value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
        </div>

        <div style={s.row}>
          <label style={s.label}>コード</label>
          <input style={s.input} value={form.code} onChange={e => set('code', e.target.value)} />
        </div>

        <div style={s.row}>
          <label style={s.label}>分類</label>
          <input style={s.input} value={form.category} onChange={e => set('category', e.target.value)} />
        </div>

        <div style={{ ...s.row, ...s.pair }}>
          <div style={s.half}>
            <label style={s.label}>ロット内数（入庫予定数の計算に使用）</label>
            <input style={s.input} type="number" value={form.lot_size} onChange={e => set('lot_size', e.target.value)} />
          </div>
          <div style={s.half}>
            <label style={s.label}>入庫リードタイム（日）</label>
            <input style={s.input} type="number" min="0" value={form.lead_time} onChange={e => set('lead_time', e.target.value)} />
          </div>
        </div>

        <div style={{ ...s.row, ...s.pair }}>
          <div style={s.half}>
            <label style={s.label}>最低在庫（下回ると赤く表示）</label>
            <input style={s.input} type="number" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} />
          </div>
          <div style={s.half}>
            <label style={s.label}>最高在庫（上回ると緑に表示）</label>
            <input style={s.input} type="number" value={form.max_stock} onChange={e => set('max_stock', e.target.value)} />
          </div>
        </div>

        {error && <div style={s.err}>{error}</div>}

        <div style={s.actions}>
          <button style={{ ...s.btn, background: '#eee', color: '#333' }} onClick={onClose}>キャンセル</button>
          <button style={{ ...s.btn, background: '#1565C0', color: '#fff' }} disabled={saving} onClick={handleCreate}>
            {saving ? '追加中...' : '追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
