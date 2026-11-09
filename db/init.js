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
    ['Yuzu Honey', 'Bright Japanese citrus with honey.', 'yuzu'],
    ['Banana Turon', 'Inspired by the Filipino fried banana roll.', 'turon'],
    ['Classic Glazed', 'The one everybody needs in the box.', 'sugar'],
    ['Chocolate Frosted', 'Thick chocolate frosting on a fluffy ring.', 'chocolate'],
    ['Glazed Donut Holes', 'Bite-size and easy to share.', 'sugar'],
  ].forEach((f, i) => add.run(f[0], f[1], f[2], i));
}

module.exports = db;
