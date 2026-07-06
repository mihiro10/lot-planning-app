import React, { useMemo } from 'react'

const s = {
  wrap:      { flex: 1, overflow: 'auto', background: '#fff' },
  table:     { borderCollapse: 'collapse', fontSize: 16, minWidth: '100%' },
  nameCol:   { position: 'sticky', left: 0, zIndex: 2, background: '#fafafa', textAlign: 'left', padding: '10px 14px', borderRight: '2px solid #999', borderBottom: '1px solid #ddd', fontWeight: 700, minWidth: 220, maxWidth: 220 },
  dateHead:  (isToday) => ({ position: 'sticky', top: 0, zIndex: 1, background: isToday ? '#1565C0' : '#fafafa', color: isToday ? '#fff' : '#333', textAlign: 'center', padding: '8px 10px', borderBottom: '2px solid #999', borderLeft: '1px solid #ddd', fontWeight: 700, whiteSpace: 'nowrap' }),
  noteCell:  (isToday) => ({ textAlign: 'left', padding: '8px 10px', borderLeft: '1px solid #eee', borderBottom: '1px solid #f0f0f0', background: isToday ? '#FFF8E1' : '#FDF0DC', color: '#8a5a1e', fontStyle: 'italic', minWidth: 90 }),
  planCell:  (isToday) => ({ textAlign: 'center', padding: '8px 10px', borderLeft: '1px solid #eee', borderBottom: '2px solid #ddd', background: isToday ? '#E3F0FF' : '#E8F4FD', fontWeight: 700, minWidth: 90 }),
  productHead: { position: 'sticky', left: 0, zIndex: 2, background: '#fafafa', borderRight: '2px solid #999', borderBottom: '2px solid #999' },
  rowLabel:  { fontSize: 11, color: '#888', fontWeight: 400 },
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function flagKey(productId, rowTypeId, date) { return `${productId}:${rowTypeId}:${date}` }

function annotate(base, flag, canceled) {
  const style = { ...base }
  if (flag) {
    style.background = flag.color + '33'
    style.boxShadow = `inset 3px 0 0 ${flag.color}`
    style.fontWeight = 700
  }
  if (canceled) {
    style.textDecoration = 'line-through'
    style.color = '#999'
    style.background = '#eee'
  }
  return style
}

export default function WorkerView({ gridData, cellFlags = {}, canceledCells = {} }) {
  const { dates, row_types, products } = gridData
  const noteRt = row_types.find(rt => rt.role === 'note')
  const planRt = row_types.find(rt => rt.role === 'plan')
  const today = todayISO()

  const rows = useMemo(() => products.map(p => ({
    product: p,
    notes: noteRt ? (p.values[String(noteRt.id)] || {}) : {},
    plans: planRt ? (p.values[String(planRt.id)] || {}) : {},
  })), [products, noteRt, planRt])

  if (!noteRt || !planRt) {
    return <div style={{ padding: 24, color: '#888' }}>備考・計画の行種別が見つかりません。</div>
  }

  return (
    <div style={s.wrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.productHead}>品目名</th>
            {dates.map(d => (
              <th key={d} style={s.dateHead(d === today)}>
                {d.slice(5).replace('-', '/')}{d === today ? ' 今日' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, notes, plans }) => (
            <React.Fragment key={product.id}>
              <tr>
                <td style={s.nameCol} rowSpan={2}>{product.name}</td>
                {dates.map(d => {
                  const flag = cellFlags[flagKey(product.id, noteRt.id, d)]
                  const canceled = canceledCells[flagKey(product.id, noteRt.id, d)]
                  return (
                    <td key={d} style={annotate(s.noteCell(d === today), flag, canceled)} title={flag?.note}>
                      {notes[d] || ''}
                    </td>
                  )
                })}
              </tr>
              <tr>
                {dates.map(d => {
                  const flag = cellFlags[flagKey(product.id, planRt.id, d)]
                  const canceled = canceledCells[flagKey(product.id, planRt.id, d)]
                  return (
                    <td key={d} style={annotate(s.planCell(d === today), flag, canceled)} title={flag?.note}>
                      {plans[d] ?? ''}
                    </td>
                  )
                })}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
