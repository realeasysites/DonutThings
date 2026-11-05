const express = require('express');
const db = require('../db/init');
const { sendLeadAlert, sendAutoReply } = require('../lib/mailer');

const router = express.Router();

// tiny in-memory rate limit: 6 submissions / 15 min / IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const win = 15 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 6;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const list = (v, max) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => clean(x, 60)).filter(Boolean).join(', ').slice(0, max);

router.post('/api/box', (req, res) => {
  const b = req.body || {};
  // honeypot: real people never fill the hidden "company" field
  if (b.company) return res.json({ ok: true });
  if (limited(req.ip)) return res.status(429).json({ ok: false, error: 'Too many requests. Call the shop at (207) 591-7112.' });

  const lead = {
    name: clean(b.name, 120),
    phone: clean(b.phone, 40),
    email: clean(b.email, 160),
    pickup_date: clean(b.pickup_date, 20),
    pickup_time: clean(b.pickup_time, 40),
    quantity: clean(b.quantity, 40),
    flavors: list(b.flavors, 500),
    occasion: clean(b.occasion, 60),
    details: clean(b.details, 2000),
    source: clean(b.source, 200),
  };

  if (!lead.name || lead.phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ ok: false, error: 'Add your name and a 10-digit phone number so we can confirm your box.' });
  }
  if (!lead.pickup_date || !/^\d{4}-\d{2}-\d{2}$/.test(lead.pickup_date)) {
    return res.status(400).json({ ok: false, error: 'Pick the day you want to come get your box.' });
  }
  if (!lead.quantity) {
    return res.status(400).json({ ok: false, error: 'Choose how many donuts you need.' });
  }
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
    return res.status(400).json({ ok: false, error: 'That email address looks off. You can leave it blank.' });
  }

  db.prepare(
    `INSERT INTO leads (name, phone, email, pickup_date, pickup_time, quantity, flavors, occasion, details, source)
     VALUES (@name, @phone, @email, @pickup_date, @pickup_time, @quantity, @flavors, @occasion, @details, @source)`
  ).run(lead);

  // fire-and-forget emails; a mail problem must never lose or block a request
  sendLeadAlert(lead).catch((e) => console.error('alert email failed:', e.message));
  sendAutoReply(lead).catch((e) => console.error('auto-reply failed:', e.message));

  res.json({ ok: true });
});

module.exports = router;
