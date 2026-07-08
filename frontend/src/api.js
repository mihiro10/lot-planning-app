import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getGrid        = (start, end)   => api.get('/grid', { params: { start, end } }).then(r => r.data)
export const getMonths      = ()             => api.get('/months').then(r => r.data)
export const createMonth    = (body)         => api.post('/months', body).then(r => r.data)
export const getRowTypes    = ()             => api.get('/row-types').then(r => r.data)
export const createRowType  = (body)         => api.post('/row-types', body).then(r => r.data)
export const deleteRowType  = (id)           => api.delete(`/row-types/${id}`)
export const reorderRowTypes = (orderedIds)  => api.post('/row-types/reorder', { ordered_ids: orderedIds })
export const getProducts    = (params)       => api.get('/products', { params }).then(r => r.data)
export const createProduct  = (body)         => api.post('/products', body).then(r => r.data)
export const updateProduct  = (id, body)     => api.patch(`/products/${id}`, body)
export const deleteProduct  = (id)           => api.delete(`/products/${id}`)
export const updateValue    = (body)         => api.put('/values', body).then(r => r.data)
export const updateValuesBatch = (updates)   => api.put('/values/batch', { updates }).then(r => r.data)

// Full change history (every set/clear, not just the latest) — for tracking
// down "did this value disappear, and who/when" during early real use
export const getChangeLog   = (start, end, q) => api.get('/change-log', { params: { start, end, q } }).then(r => r.data)

export const getProductAttributes = (productId)           => api.get(`/products/${productId}/attributes`).then(r => r.data)
export const createAttribute      = (body)                => api.post('/attributes', body).then(r => r.data)
export const setAttributeValue    = (productId, attrId, value) => api.put(`/attributes/${productId}/${attrId}`, { value })

// Canceled cells — excluded from 入庫予定数/最終, raw value stays visible with a strikethrough
export const getCanceledCells = (start, end) => api.get('/canceled-cells', { params: { start, end } }).then(r => r.data)
export const cancelCell       = (body)       => api.put('/canceled-cells', body).then(r => r.data)
export const uncancelCell     = (body)       => api.delete('/canceled-cells', { data: body }).then(r => r.data)

// Cell flags — manual edit-after-submit highlighting (§7 Q1: manual color pick, shared via WS)
export const getCellFlags   = (start, end)   => api.get('/cell-flags', { params: { start, end } }).then(r => r.data)
export const setCellFlag    = (body)         => api.put('/cell-flags', body).then(r => r.data)
export const clearCellFlag  = (body)         => api.delete('/cell-flags', { data: body }).then(r => r.data)

// Lot links — reschedule/split/transfer arrows (§7 Q2: manual click-to-link)
export const getLotLinks    = (start, end)   => api.get('/lot-links', { params: { start, end } }).then(r => r.data)
export const createLotLink  = (body)         => api.post('/lot-links', body).then(r => r.data)
export const deleteLotLink  = (id)           => api.delete(`/lot-links/${id}`)

// Stocktake / 在庫修正 — reconcile a physical count against the system's calculated 最終
export const getFinalValue  = (productId, on) => api.get('/final-value', { params: { product_id: productId, on } }).then(r => r.data)
export const applyStocktake = (body)          => api.post('/stocktake', body).then(r => r.data)
export const getFinalValues      = (on)   => api.get('/final-values', { params: { on } }).then(r => r.data)
export const applyStocktakeBatch = (body) => api.post('/stocktake/batch', body).then(r => r.data)

// Inventory reduction analysis dashboard
export const getAnalysis    = (start, end)    => api.get('/analysis', { params: { start, end } }).then(r => r.data)

// Auto-reconnects with backoff — every computed cell (入庫予定数, 最終, etc.)
// only ever updates via this connection, so a dropped socket that never
// reconnects silently freezes all calculated values until a manual reload.
export function connectWebSocket(onMessage, { onOpen, onClose } = {}) {
  let socket = null
  let closedByCaller = false
  let retryDelay = 1000

  function open() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    socket = new WebSocket(`${proto}://${window.location.host}/ws`)
    socket.onmessage = (e) => onMessage(JSON.parse(e.data))
    socket.onerror = () => {}  // onclose fires right after; avoid duplicate noise
    socket.onopen = () => {
      retryDelay = 1000
      onOpen?.()
    }
    socket.onclose = () => {
      onClose?.()
      if (closedByCaller) return
      setTimeout(open, retryDelay)
      retryDelay = Math.min(retryDelay * 2, 15000)
    }
  }

  open()

  return {
    close: () => { closedByCaller = true; socket?.close() },
  }
}
