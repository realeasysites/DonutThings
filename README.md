# Donut Things Café website

Node 20, Express, SQLite. `npm install`, then `npm start`.

## Render
- Build: `npm install`. Start: `node server.js`.
- Set `ADMIN_PASSWORD`, `SESSION_SECRET` and `SITE_URL`. For email alerts, also set `NOTIFY_EMAIL` and the `SMTP_*` values (see `.env.example`).
- Use a paid instance with a disk and `DB_PATH=/var/data/donut-things.sqlite`. The free plan wipes box requests, flavor edits and hours on every deploy.

## Dashboard (/admin)
Password-only login. Tabs: Box requests (status, notes, delete), Flavors (add, edit, reorder, sold out, delete), Hours & info (hours, top banner, Instagram link), Traffic.

## Entrance film
Files are in `public/intro`. It plays once per visitor, with Skip and Sound buttons. Add `?intro=1` to the URL to replay it.

## Photos
See the README.txt files in `public/img/photos` and `public/img/flavors`. Files are picked up by name when the site loads.
