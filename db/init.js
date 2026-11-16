const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// On Render, put this on a persistent disk (DB_PATH=/var/data/donut-things.sqlite)
// so box requests, flavors and hours survive deploys.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'donut-things.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    pickup_date TEXT,
    pickup_time TEXT,
    quantity TEXT,
    flavors TEXT,
    occasion TEXT,
    details TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

  CREATE TABLE IF NOT EXISTS flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    blurb TEXT,
    glaze TEXT NOT NULL DEFAULT 'pink',
    sort INTEGER NOT NULL DEFAULT 0,
    sold_out INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS sa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    visitor TEXT NOT NULL,
    type TEXT NOT NULL,
    path TEXT,
    source TEXT,
    device TEXT,
    label TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sa_ts ON sa_events(ts);
`);

// First boot only: flavors from their own posts and The Hungry Mainer's post.
if (db.prepare('SELECT COUNT(*) n FROM flavors').get().n === 0) {
  const add = db.prepare('INSERT INTO flavors (name, blurb, glaze, sort) VALUES (?,?,?,?)');
  [
    ['Biscoff Dragon', 'Fluffy and golden, loaded with buttery Biscoff crunch.', 'sugar'],
    ['Matcha Maple Bacon', 'Sweet, smoky and a little bit green.', 'bacon'],
    ['Matcha Oreo', 'Earthy matcha meets cookies and cream.', 'oreo'],
    ['Coconut Pandan', 'Coconut with fragrant Southeast Asian pandan.', 'pandan'],
    ['Mango Tajín', 'Sweet mango with a chili-lime kick.', 'mango'],
    ['Yuzu Honey', 'Honey glaze topped with candied yuzu peel.', 'yuzu'],
    ['Banana Turon', 'Inspired by the Filipino fried banana roll.', 'turon'],
    ['Vanilla Jasmine', 'Vanilla bean glaze with floral jasmine.', 'vanilla'],
    ['Classic Glazed', 'The one everybody needs in the box.', 'sugar'],
    ['Classic Glazed Twist', 'A twisted take on the classic glazed.', 'sugar'],
    ['Chocolate Frosted', 'Thick chocolate frosting on a fluffy ring.', 'chocolate'],
    ['Boston Cream', 'Custard-filled and topped with chocolate.', 'chocolate'],
    ['Glazed Donut Holes', 'Bite-size and easy to share.', 'sugar'],
  ].forEach((f, i) => add.run(f[0], f[1], f[2], i));
}

// Prices (added Nov 2026). Stored as plain text like "4.75"; blank = no price shown.
if (!db.prepare('PRAGMA table_info(flavors)').all().some((c) => c.name === 'price')) {
  db.exec('ALTER TABLE flavors ADD COLUMN price TEXT');
}
// One-time fill of the owner's Nov 16, 2026 price list. Runs once, only fills blanks,
// so prices edited later in the dashboard are never overwritten.
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'prices_seeded_v1'").get()) {
  const prices = {
    'matcha oreo': '4.75', 'biscoff dragon': '6.75', 'coconut pandan': '6.50', 'mango tajín': '6.50',
    'banana turon': '6.50', 'classic glazed': '3.25', 'chocolate frosted': '3.75', 'boston cream': '4.25',
    'yuzu honey': '3.75', 'vanilla jasmine': '3.75', 'matcha maple bacon': '4.75',
  };
  const fill = db.prepare("UPDATE flavors SET price = ? WHERE lower(name) = ? AND (price IS NULL OR price = '')");
  Object.entries(prices).forEach(([n, v]) => fill.run(v, n));
  db.prepare("INSERT INTO settings (key, value) VALUES ('prices_seeded_v1', '1')").run();
}

// Default hours, given by the owner Nov 2026. INSERT OR IGNORE never overwrites
// hours that were already saved in the dashboard.
db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('hours', 'Mon–Sat: 8am–2pm\nSunday: Closed');

module.exports = db;
