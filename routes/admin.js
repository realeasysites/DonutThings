const express = require('express');
const path = require('path');
const db = require('../db/init');
const auth = require('../lib/auth');
const { statsFor } = require('./analytics');
const { GLAZES } = require('../lib/render');

const router = express.Router();
const STATUSES = ['new', 'confirmed', 'picked up', 'not a lead'];
const SETTINGS = ['hours', 'notice', 'instagram_url'];

const fails = new Map(); // simple login throttle per IP
function throttled(ip) {
  const now = Date.now();
  const arr = (fails.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  fails.set(ip, arr);
  return arr.length >= 8;
}

router.use(['/admin', '/admin/*'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', auth.isAuthed(req) ? 'admin.html' : 'login.html'));
});

router.get('/admin/status', (req, res) => {
  res.json({ loginEnabled: auth.loginEnabled(), authed: auth.isAuthed(req) });
});

router.post('/admin/login', express.json({ limit: '4kb' }), (req, res) => {
  if (!auth.loginEnabled()) return res.status(503).json({ ok: false, error: 'Login is not set up yet. Set ADMIN_PASSWORD (8+ characters).' });
  if (throttled(req.ip)) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again in a few minutes.' });
  if (!auth.checkPassword((req.body || {}).password)) {
    fails.get(req.ip).push(Date.now());
    return res.status(401).json({ ok: false, error: 'Wrong password.' });
  }
  auth.issue(req, res);
  res.json({ ok: true });
});

router.get('/admin/logout', (req, res) => {
  auth.clear(res);
  res.redirect('/admin');
});

const api = express.Router();
api.use(auth.requireAdminApi);
api.use(express.json({ limit: '16kb' }));

// Box requests
api.get('/leads', (req, res) => {
  res.json({ statuses: STATUSES, leads: db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1000').all() });
});

api.patch('/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(id)) return res.status(404).json({ error: 'not found' });
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'bad status' });
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(b.status, id);
  }
  if (b.notes !== undefined) db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(String(b.notes).slice(0, 4000), id);
  res.json({ ok: true });
});

api.delete('/leads/:id', (req, res) => {
  res.json({ ok: db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id)).changes > 0 });
});

// Flavors
const cleanFlavor = (b) => ({
  name: String(b.name || '').trim().slice(0, 60),
  blurb: String(b.blurb || '').trim().slice(0, 140),
  glaze: GLAZES[b.glaze] ? b.glaze : 'pink',
  sold_out: b.sold_out ? 1 : 0,
});

api.get('/flavors', (req, res) => {
  res.json({
    glazes: Object.keys(GLAZES).map((k) => ({ key: k, label: GLAZES[k].label })),
    flavors: db.prepare('SELECT * FROM flavors ORDER BY sort, id').all(),
  });
});

api.post('/flavors', (req, res) => {
  const f = cleanFlavor(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'Add a flavor name.' });
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 n FROM flavors').get().n;
  const r = db.prepare('INSERT INTO flavors (name, blurb, glaze, sold_out, sort) VALUES (?,?,?,?,?)').run(f.name, f.blurb, f.glaze, f.sold_out, sort);
  res.json({ ok: true, id: r.lastInsertRowid });
});

api.put('/flavors/:id', (req, res) => {
  const f = cleanFlavor(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'Add a flavor name.' });
  const r = db.prepare('UPDATE flavors SET name=?, blurb=?, glaze=?, sold_out=? WHERE id=?').run(f.name, f.blurb, f.glaze, f.sold_out, Number(req.params.id));
  res.json({ ok: r.changes > 0 });
});

api.post('/flavors/order', (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map(Number) : [];
  const up = db.prepare('UPDATE flavors SET sort = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => up.run(i, id)))();
  res.json({ ok: true });
});

api.delete('/flavors/:id', (req, res) => {
  res.json({ ok: db.prepare('DELETE FROM flavors WHERE id = ?').run(Number(req.params.id)).changes > 0 });
});

// Hours, notice, Instagram
api.get('/settings', (req, res) => {
  const out = {};
  SETTINGS.forEach((k) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    out[k] = row ? row.value : '';
  });
  res.json(out);
});

api.put('/settings', (req, res) => {
  const b = req.body || {};
  const ig = String(b.instagram_url || '').trim();
  if (ig && !/^https:\/\/(www\.)?instagram\.com\//i.test(ig)) return res.status(400).json({ error: 'Use a full Instagram link, like https://www.instagram.com/yourshop' });
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  up.run('hours', String(b.hours || '').slice(0, 800));
  up.run('notice', String(b.notice || '').trim().slice(0, 160));
  up.run('instagram_url', ig.slice(0, 200));
  res.json({ ok: true });
});

api.get('/stats', (req, res) => {
  res.json({ d7: statsFor(7), d30: statsFor(30), d90: statsFor(90) });
});

router.use('/admin/api', api);

module.exports = router;
