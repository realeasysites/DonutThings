const express = require('express');
const fs = require('fs');
const path = require('path');

require('./db/init');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const { router: analyticsRoutes } = require('./routes/analytics');
const { renderHome } = require('./lib/render');

// Set ORDERS_PAUSED=1 on Render to hide the box-request form and refuse new requests.
const ORDERS_PAUSED = /^(1|true|yes)$/i.test(process.env.ORDERS_PAUSED || '');
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));

// Order matters: admin + API routes first, so /admin always asks for the password
// before any public file can be served.
app.use(analyticsRoutes);
app.use(adminRoutes);
app.use(express.json({ limit: '32kb' }));
app.post('/api/box', (req, res, next) => {
  if (!ORDERS_PAUSED) return next();
  res.status(503).json({ ok: false, error: 'Online box requests are paused. Call the shop at (207) 591-7112.' });
});
app.use(publicRoutes);

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const homeTpl = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
app.get(['/', '/index.html'], (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.setHeader('Cache-Control', 'no-cache');
  let html = renderHome(homeTpl, base);
  if (ORDERS_PAUSED) {
    html = html
      .replace(/<form id="boxForm"[\s\S]*?<\/form>/, `<div class="orders-paused" style="background:#fff;border-radius:16px;padding:28px;text-align:center">
        <h3 style="margin-top:0">Online box requests are coming soon</h3>
        <p>For now, call or text the shop at <a href="tel:+12075917112">(207) 591-7112</a> to reserve a box.</p>
        <a class="btn btn-glaze" href="tel:+12075917112">Call the shop</a>
      </div>`)
      .replace(/<p>Picking up for the office[\s\S]*?<\/p>/, '<p>Picking up for the office, a party or a car meet? Give us a call and we’ll set you up.</p>');
  }
  res.type('html').send(html);
});

app.get('/sitemap.xml', (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>`);
});

app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    index: false,
    maxAge: '7d',
    setHeaders(res, file) {
      if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=300');
    },
  })
);

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Donut Things Café site listening on ${port}`));
