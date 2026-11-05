const express = require('express');
const fs = require('fs');
const path = require('path');

require('./db/init');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const { router: analyticsRoutes } = require('./routes/analytics');
const { renderHome } = require('./lib/render');

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
app.use(publicRoutes);

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const homeTpl = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
app.get(['/', '/index.html'], (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderHome(homeTpl, base));
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
