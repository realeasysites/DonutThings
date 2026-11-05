// Server-rendered pieces of the home page. Flavors, hours and links are edited
// in the dashboard, so they are drawn fresh on each request and stay crawlable.
const fs = require('fs');
const path = require('path');
const db = require('../db/init');

const IMG = path.join(__dirname, '..', 'public', 'img');
const FACEBOOK = 'https://www.facebook.com/profile.php?id=61596159150677';

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// glaze colour, topping colours, topping shape
const GLAZES = {
  pink: { label: 'Pink glaze', c: '#EE5F7E', s: ['#FFFFFF', '#1FA1A8', '#F4C542'], t: 'sprinkle' },
  yuzu: { label: 'Yuzu yellow', c: '#F6D860', s: ['#FFF8D6', '#EFA92B'], t: 'fleck' },
  mango: { label: 'Mango orange', c: '#F79A2E', s: ['#B5301B', '#FFD27A'], t: 'fleck' },
  turon: { label: 'Caramel', c: '#C88A3C', s: ['#F3DDB0', '#7A4418'], t: 'drizzle' },
  pandan: { label: 'Pandan green', c: '#B4DA96', s: ['#C98A3C', '#EBCB95'], t: 'flake' },
  oreo: { label: 'Matcha + cookie crumbs', c: '#5F8F34', s: ['#22140C', '#3A2A20'], t: 'crumb' },
  bacon: { label: 'Matcha + bacon', c: '#5F8F34', s: ['#9E3522', '#D9835B'], t: 'strip' },
  chocolate: { label: 'Chocolate', c: '#5A3320', s: ['#F2D9B5', '#EE5F7E'], t: 'sprinkle' },
  vanilla: { label: 'Vanilla white', c: '#FBF3E4', s: ['#EE5F7E', '#1FA1A8'], t: 'sprinkle' },
  ube: { label: 'Ube purple', c: '#9A7BC8', s: ['#F3E8FF'], t: 'flake' },
  strawberry: { label: 'Strawberry', c: '#F49AA8', s: ['#C92F4C', '#FFFFFF'], t: 'fleck' },
  sugar: { label: 'Cinnamon sugar', c: '#E0AE6E', s: ['#8A5222', '#F7E4C3'], t: 'fleck' },
};

// Small seeded generator so a flavor's toppings stay put between page loads.
function rng(seed) {
  let x = 0;
  for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function toppings(g, name) {
  const r = rng(name);
  const out = [];
  if (g.t === 'drizzle') {
    for (let i = 0; i < 5; i++) {
      const y = 36 + i * 14;
      out.push(`<path d="M14 ${y}q18 -13 36 0t36 0" fill="none" stroke="${g.s[i % 2]}" stroke-width="3" stroke-linecap="round"/>`);
    }
    return out.join('');
  }
  const n = { sprinkle: 26, fleck: 44, flake: 26, crumb: 38, strip: 8 }[g.t];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 21 + r() * 18;
    const x = (50 + Math.cos(a) * d).toFixed(1);
    const y = (50 + Math.sin(a) * d).toFixed(1);
    const c = g.s[Math.floor(r() * g.s.length)];
    const rot = Math.floor(r() * 180);
    if (g.t === 'sprinkle') out.push(`<rect x="${x}" y="${y}" width="6" height="2.4" rx="1.2" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`);
    else if (g.t === 'fleck') out.push(`<circle cx="${x}" cy="${y}" r="${(0.7 + r() * 0.8).toFixed(1)}" fill="${c}"/>`);
    else if (g.t === 'flake') out.push(`<rect x="${x}" y="${y}" width="${(3 + r() * 4).toFixed(1)}" height="1.3" rx=".6" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`);
    else if (g.t === 'crumb') out.push(`<polygon points="${x},${y} ${(+x + 3).toFixed(1)},${(+y + 1).toFixed(1)} ${(+x + 1).toFixed(1)},${(+y + 3).toFixed(1)}" fill="${c}"/>`);
    else out.push(`<g transform="rotate(${rot} ${x} ${y})"><rect x="${x}" y="${y}" width="12" height="4.6" rx="1" fill="#9E3522"/><rect x="${x}" y="${(+y + 1.7).toFixed(1)}" width="12" height="1.1" fill="#F0B595"/></g>`);
  }
  return out.join('');
}

function donutSvg(f) {
  const g = GLAZES[f.glaze] || GLAZES.pink;
  const id = 'h' + f.id;
  return (
    `<svg class="donut" viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="${id}"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="14" fill="#000"/></mask><clipPath id="${id}c"><path d="M50 7c13 0 24 5 32 14 6 7 12 12 10 22-1 7 4 13 0 21-4 9-8 11-16 18-8 6-17 9-26 9s-18-3-26-9c-7-6-13-10-16-19-3-8 1-14 0-21-1-9 4-14 10-21C26 12 37 7 50 7z"/></clipPath></defs>` +
    `<g mask="url(#${id})"><circle cx="50" cy="51" r="47" fill="#DFA45A"/>` +
    `<path d="M50 7c13 0 24 5 32 14 6 7 12 12 10 22-1 7 4 13 0 21-4 9-8 11-16 18-8 6-17 9-26 9s-18-3-26-9c-7-6-13-10-16-19-3-8 1-14 0-21-1-9 4-14 10-21C26 12 37 7 50 7z" fill="${g.c}"/>` +
    `<g clip-path="url(#${id}c)">${toppings(g, f.name)}</g>` +
    `</g></svg>`
  );
}

function setting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value || '' : '';
}

function flavors() {
  return db.prepare('SELECT * FROM flavors ORDER BY sort, id').all();
}

function flavorPhoto(f) {
  const base = slug(f.name);
  for (const ext of ['jpg', 'webp', 'png']) {
    if (fs.existsSync(path.join(IMG, 'flavors', `${base}.${ext}`))) return `/img/flavors/${base}.${ext}`;
  }
  return '';
}

function boxHtml() {
  const list = flavors();
  if (!list.length) return '<p class="box-empty">New flavors are on the way. Call the shop for what’s in the case today.</p>';
  return list
    .map((f) => {
      const photo = flavorPhoto(f);
      const art = photo ? `<img class="donut-photo" src="${photo}" alt="${esc(f.name)} donut" loading="lazy" width="400" height="400">` : donutSvg(f);
      return (
        `<li class="slot${f.sold_out ? ' is-out' : ''}">` +
        `<div class="slot-paper">${art}${f.sold_out ? '<span class="out-tag">Sold out today</span>' : ''}</div>` +
        `<h3>${esc(f.name)}</h3>` +
        (f.blurb ? `<p>${esc(f.blurb)}</p>` : '') +
        `</li>`
      );
    })
    .join('');
}

function flavorChecks() {
  return flavors()
    .filter((f) => !f.sold_out)
    .map((f) => `<label class="check"><input type="checkbox" name="flavors" value="${esc(f.name)}"><span>${esc(f.name)}</span></label>`)
    .join('');
}

function hoursHtml() {
  const lines = setting('hours').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return `<p>Hours are posted on our <a href="${FACEBOOK}" target="_blank" rel="noopener" data-social="facebook">Facebook page</a>.</p>`;
  }
  return `<ul class="hours">${lines
    .map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? `<li><span>${esc(l.slice(0, i))}</span><span>${esc(l.slice(i + 1).trim())}</span></li>` : `<li><span>${esc(l)}</span></li>`;
    })
    .join('')}</ul>`;
}

function photo(name, alt) {
  for (const ext of ['jpg', 'webp', 'png']) {
    if (fs.existsSync(path.join(IMG, 'photos', `${name}.${ext}`))) return `<img src="/img/photos/${name}.${ext}" alt="${esc(alt)}" loading="lazy">`;
  }
  return '';
}

function galleryHtml() {
  const items = [1, 2, 3, 4, 5, 6].map((n) => photo(`shop-${n}`, 'Inside Donut Things Café in Westbrook, Maine')).filter(Boolean);
  if (!items.length) return '';
  return `<section class="gallery" aria-label="Photos from the shop"><div class="gallery-track">${items.map((i) => `<figure>${i}</figure>`).join('')}</div></section>`;
}

function socialHtml() {
  const ig = setting('instagram_url');
  const fb = `<a href="${FACEBOOK}" target="_blank" rel="noopener" data-social="facebook" aria-label="Donut Things Café on Facebook"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M14 8.5V6.8c0-.8.5-1 1-1h2V2.2L14.2 2C11.3 2 10 3.7 10 6.3v2.2H7.5V12H10v10h4V12h2.800l.5-3.500z"/></svg></a>`;
  const igA = ig
    ? `<a href="${esc(ig)}" target="_blank" rel="noopener" data-social="instagram" aria-label="Donut Things Café on Instagram"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg></a>`
    : '';
  return fb + igA;
}

function noticeHtml() {
  const n = setting('notice').trim();
  return n ? `<p class="notice">${esc(n)}</p>` : '';
}

function renderHome(tpl, siteUrl) {
  const canonical = siteUrl || '';
  return tpl
    .replace(/%%SITE_URL%%/g, canonical)
    .replace('<!--NOTICE-->', noticeHtml())
    .replace('<!--BOX-->', boxHtml())
    .replace('<!--FLAVOR_CHECKS-->', flavorChecks())
    .replace('<!--HOURS-->', hoursHtml())
    .replace('<!--GALLERY-->', galleryHtml())
    .replace('<!--PHOTO_MATCHA-->', photo('matcha', 'Matcha drink at Donut Things Café'))
    .replace('<!--PHOTO_COFFEE-->', photo('coffee', 'Coffee at Donut Things Café'))
    .replace(/<!--SOCIAL-->/g, socialHtml());
}

module.exports = { renderHome, GLAZES, setting, flavors };
