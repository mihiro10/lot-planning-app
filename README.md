# ロット計画アプリ (Lot Planning App)

A continuous inventory planning grid that replaces the month-siloed Excel workflow.
Instead of copying last month's ending balance into a new sheet every month, 最終
(ending inventory) rolls forward automatically across one continuous timeline —
you scroll, you don't copy-paste.

FastAPI + SQLite backend, React + ag-Grid frontend, live-synced across everyone
currently viewing the grid over a WebSocket.

## Quick start

```bash
./start.sh
```

This creates a Python venv, installs backend deps, installs frontend deps, and
starts both servers:

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

First run with no data yet will prompt you through Setup (pick a date range,
optionally import an existing planning Excel file).

### Manual setup

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## What it does

**Continuous timeline** — 入庫予定数 and 最終 are computed by walking the full
date range for each product (`formula.py` / `_recompute_product` in `main.py`),
seeded once from the earliest known starting inventory rather than resetting at
every month boundary. `months` still exists as a reporting label, it's just no
longer a calculation boundary.

**Excel import** — `importer.py` detects columns by header text (not hardcoded
positions), since different planning sheets reorder columns. Captures product
master data, daily plan/demand/adjustment values, and 備考 (free-text notes per
date, e.g. "追加"/"変更"/"キャンセル").

**Manual edit-highlighting** — click 変更ハイライト, then a cell, to flag it
with a color and note. Shared live with everyone via WebSocket broadcast, not a
private view.

**Lot links** — click リンク作成, then two cells, to draw an arrow connecting
them: reschedule (same item, different date), split (one lot feeding multiple
products), or transfer (moved to another storage location, with an optional
quantity conversion factor).

**Cancellation** — click 取り消し, then a cell, to mark a planned entry as
canceled. The number stays visible with a strikethrough for reference, but is
excluded from 入庫予定数/最終 — a canceled plan won't actually be produced, so
it shouldn't feed the forecast.

**Stocktake reconciliation** — 棚卸し/在庫修正 diffs a physically-counted
quantity against the system's calculated 最終 and writes the difference into
調整. 月次棚卸し is the same thing at scale: every product in one table, for
walking the whole floor once a month, with a progress counter and a warning
highlight when a count differs from the system value by more than 30%.

**在庫分析** — average/min/max final inventory per product over a date range,
flagging candidates for lowering buffer stock (the original business goal:
free up fridge/freezer space without risking stockouts).

**現場ビュー** — large-font, read-only view showing just 品目名 + 備考 + 計画
for floor workers who only need to know what to make today, not the full
office-side grid.

**Paste** — select a starting cell, paste a block of numbers copied from
Excel, and it fills forward through dates/rows from there in one batch write.
(ag-Grid Community doesn't include drag-to-select range selection — that's an
Enterprise module — so this is a lighter custom implementation: paste relative
to the focused cell rather than a highlighted range.)

## Project structure

```
backend/
  main.py        FastAPI app — all endpoints, grid computation, WebSocket broadcast
  database.py    SQLite schema
  formula.py     入庫予定数/最終 calculation
  importer.py    Excel parsing (header-based column detection)
backend/lot_planning.db   SQLite database (gitignored — local data, not source)

frontend/src/
  App.jsx                       Shell — state, WebSocket wiring, view switching
  api.js                        Backend API client
  components/PlanningGrid.jsx   Main ag-Grid view (editing, flags, links, paste)
  components/BulkStocktakeScreen.jsx   月次棚卸し
  components/AnalysisDashboard.jsx     在庫分析
  components/WorkerView.jsx            現場ビュー
  components/ProductPanel.jsx          Per-product settings
  components/Setup.jsx                 First-run onboarding / Excel import
  components/Sidebar.jsx               Row visibility, filters, add custom row
```

## Known limitations

- No auth — attribution (who changed what) is a free-text name field stored in
  `localStorage`, not a real user system.
- No conflict resolution — two people editing the same cell within the same
  second is last-write-wins, with no warning.
- Paste can't select a visual range first (see above) — Enterprise ag-Grid
  would add that.
