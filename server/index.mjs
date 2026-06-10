// Local studio server — SQLite-backed REST API + static hosting of the
// built frontend. Run with:  npm run server   (vite dev proxies /api here)

import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, listAll, upsertRow, updateRow, deleteRow, counts } from './db.mjs';
import { importWorkbook } from './importExcel.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Deliberately not the generic PORT — dev tools inject PORT for the vite
// frontend and the API must not steal it.
const PORT = process.env.STUDIO_API_PORT || 8787;

const app = express();
app.use(express.json({ limit: '10mb' }));

const ORDER_BY = {
  producers: 'sort_index', teams: 'sort_index', projects: 'sort_index',
  history: 'completed_date desc', assignments: 'date', producer_tasks: 'sort_index',
};

app.get('/api/health', (_req, res) => res.json({ ok: true, counts: counts() }));

app.get('/api/bootstrap', (_req, res) => {
  const out = {};
  for (const t of Object.keys(TABLES)) out[t] = listAll(t, ORDER_BY[t]);
  res.json(out);
});

// Excel import — raw .xlsx body. ?mode=replace (default) wipes first;
// ?mode=merge upserts on top of existing data.
app.post('/api/import', express.raw({ type: () => true, limit: '60mb' }), (req, res) => {
  try {
    if (!req.body || !req.body.length) return res.status(400).json({ error: 'קובץ ריק' });
    const mode = req.query.mode === 'merge' ? 'merge' : 'replace';
    const summary = importWorkbook(req.body, { mode });
    res.json(summary);
  } catch (e) {
    console.error('import failed:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

function guardTable(req, res, next) {
  if (!TABLES[req.params.table]) return res.status(404).json({ error: 'unknown table' });
  next();
}

app.post('/api/:table', guardTable, (req, res) => {
  try { res.json(upsertRow(req.params.table, req.body)); }
  catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

app.patch('/api/:table/:id', guardTable, (req, res) => {
  try { res.json(updateRow(req.params.table, req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

app.delete('/api/:table/:id', guardTable, (req, res) => {
  try { deleteRow(req.params.table, req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

// Static hosting of the production build (when present).
const dist = join(__dirname, '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`studio server listening on http://localhost:${PORT}`);
  console.log('db counts:', JSON.stringify(counts()));
});
