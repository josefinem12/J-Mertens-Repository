/* ============================================================
   Tovertafel Dashboard — Backend Server
   Node.js + Express + SQLite (better-sqlite3) + JWT auth
   ============================================================ */

const express      = require("express");
const Database     = require("better-sqlite3");
const bcrypt       = require("bcryptjs");
const jwt          = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path         = require("path");
const fs           = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── JWT secret ───────────────────────────────────────────
   On Railway, set the environment variable JWT_SECRET to a
   long random string (e.g. run: openssl rand -hex 32).
   Falls back to a default for local development only.
   ─────────────────────────────────────────────────────── */
const JWT_SECRET = process.env.JWT_SECRET || "tover-dev-secret-change-in-production";
const JWT_EXPIRY  = "7d"; // tokens valid for 7 days

/* ─── Database setup ───────────────────────────────────────
   SQLite database stored at /data/tover.db on Railway
   (persistent volume) or ./tover.db locally.
   ─────────────────────────────────────────────────────── */
const DB_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "tover.db")
  : path.join(__dirname, "..", "tover.db");

// Ensure the data directory exists (for Railway volumes)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // better concurrent read performance

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    name          TEXT    DEFAULT '',
    institution   TEXT    DEFAULT '',
    tovertafel_id TEXT    DEFAULT '',
    country       TEXT    DEFAULT '',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log(`Database ready at ${DB_PATH}`);

/* ─── Middleware ─────────────────────────────────────────── */
app.use(express.json());
app.use(cookieParser());
// Serve the frontend files from the /public folder
app.use(express.static(path.join(__dirname, "..", "public")));

/* ─── Auth middleware ────────────────────────────────────── */
function requireAuth(req, res, next) {
  const token = req.cookies.tover_token || req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie("tover_token");
    res.status(401).json({ error: "Session expired — please sign in again" });
  }
}

/* ============================================================
   AUTH ROUTES
   ============================================================ */

/* POST /api/register */
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required." });

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers, underscore." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing)
    return res.status(409).json({ error: "That username is already taken." });

  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, passwordHash);

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.cookie("tover_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, username, name: "", institution: "", tovertafelId: "", country: "" });
});

/* POST /api/login */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user)
    return res.status(401).json({ error: "No account found with that username." });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match)
    return res.status(401).json({ error: "Incorrect password." });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.cookie("tover_token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({
    ok: true,
    username,
    name:          user.name          || "",
    institution:   user.institution   || "",
    tovertafelId:  user.tovertafel_id || "",
    country:       user.country       || "",
  });
});

/* POST /api/logout */
app.post("/api/logout", (req, res) => {
  res.clearCookie("tover_token");
  res.json({ ok: true });
});

/* GET /api/me — check current session */
app.get("/api/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({
    ok: true,
    username:      user.username,
    name:          user.name          || "",
    institution:   user.institution   || "",
    tovertafelId:  user.tovertafel_id || "",
    country:       user.country       || "",
  });
});

/* PUT /api/profile — update profile fields */
app.put("/api/profile", requireAuth, (req, res) => {
  const { name, institution, tovertafelId, country } = req.body;
  db.prepare(`
    UPDATE users
    SET name = ?, institution = ?, tovertafel_id = ?, country = ?
    WHERE username = ?
  `).run(
    name         || "",
    institution  || "",
    tovertafelId || "",
    country      || "",
    req.user.username
  );
  res.json({ ok: true });
});

/* ─── Catch-all: serve index.html for any non-API route ─── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/* ─── Start server ─────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Tovertafel Dashboard running on port ${PORT}`);
});
