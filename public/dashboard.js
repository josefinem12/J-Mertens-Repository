/* ============================================================
   Tovertafel Care Dashboard — Frontend Logic
   BSc Computational Social Science, University of Amsterdam
   Partner: Tover Health Tech · March 2026
   ============================================================ */

/* ============================================================
   API ACCOUNT SYSTEM
   ------------------------------------------------------------
   All auth and profile operations talk to the Express backend
   via fetch(). The server sets an httpOnly JWT cookie on login/
   register, so no tokens are stored in JS — the browser handles
   them automatically on every request.

   /api/register  POST  { username, password }
   /api/login     POST  { username, password }
   /api/logout    POST  (clears cookie)
   /api/me        GET   → returns current user profile
   /api/profile   PUT   { name, institution, tovertafelId, country }
   ============================================================ */

/* ─── UI helpers ─── */
function setAuthLoading(loading) {
  document.querySelectorAll(".auth-btn").forEach(b => {
    b.disabled    = loading;
    b.textContent = loading ? "Please wait…" : b.dataset.label;
  });
}
function setAuthError(id, msg) {
  document.getElementById(id).textContent = msg;
}
function clearAuthErrors() {
  document.querySelectorAll(".auth-error").forEach(el => el.textContent = "");
}
function showAuthScreen() {
  document.getElementById("auth-screen").style.display     = "flex";
  document.getElementById("dashboard-shell").style.display = "none";
}
function showLoadingScreen() {
  document.getElementById("auth-screen").style.display     = "flex";
  document.getElementById("dashboard-shell").style.display = "none";
  document.getElementById("auth-loading").style.display    = "flex";
  document.getElementById("auth-tabs").style.display       = "none";
  document.getElementById("auth-login").style.display      = "none";
  document.getElementById("auth-register").style.display   = "none";
}
function hideLoadingScreen() {
  document.getElementById("auth-loading").style.display = "none";
  document.getElementById("auth-tabs").style.display    = "flex";
  document.getElementById("auth-login").style.display   = "flex";
}

/* ─── AUTH PANEL TOGGLE ─── */
function showAuthPanel(panel) {
  document.getElementById("auth-login").style.display    = panel === "login"    ? "flex" : "none";
  document.getElementById("auth-register").style.display = panel === "register" ? "flex" : "none";
  clearAuthErrors();
}

/* ─── API wrapper ─── */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin", // always send the JWT cookie
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ─── LOGIN ─── */
async function doLogin() {
  const username = document.getElementById("login-username").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  if (!username || !password) { setAuthError("login-error", "Please fill in both fields."); return; }
  setAuthLoading(true);
  try {
    const user = await apiFetch("/api/login", { method: "POST", body: { username, password } });
    bootDashboard(user);
  } catch (err) {
    setAuthError("login-error", err.message);
  } finally {
    setAuthLoading(false);
  }
}

/* ─── REGISTER ─── */
async function doRegister() {
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const confirm  = document.getElementById("reg-confirm").value;
  if (!username || !password)           { setAuthError("reg-error", "Please fill in all fields."); return; }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) { setAuthError("reg-error", "Username: 3–20 chars, letters/numbers/underscore."); return; }
  if (password.length < 6)              { setAuthError("reg-error", "Password must be at least 6 characters."); return; }
  if (password !== confirm)             { setAuthError("reg-error", "Passwords do not match."); return; }
  setAuthLoading(true);
  try {
    const user = await apiFetch("/api/register", { method: "POST", body: { username, password } });
    bootDashboard(user);
  } catch (err) {
    setAuthError("reg-error", err.message);
  } finally {
    setAuthLoading(false);
  }
}

/* ─── LOGOUT ─── */
async function doLogout() {
  try { await apiFetch("/api/logout", { method: "POST" }); } catch {}
  location.reload();
}

/* ─── BOOT DASHBOARD ─── */
function bootDashboard(user) {
  document.getElementById("auth-screen").style.display     = "none";
  document.getElementById("dashboard-shell").style.display = "grid";

  // Sidebar chip
  document.getElementById("user-av").textContent   = user.username.slice(0, 2).toUpperCase();
  document.getElementById("user-name").textContent = user.name || user.username;
  document.getElementById("user-role").textContent = user.institution || "Tovertafel Dashboard";

  // Pre-fill profile form
  document.getElementById("pf-username").value    = user.username;
  document.getElementById("pf-name").value        = user.name         || "";
  document.getElementById("pf-institution").value = user.institution  || "";
  document.getElementById("pf-tover-id").value    = user.tovertafelId || "";
  document.getElementById("pf-country").value     = user.country      || "";

  renderLib();
}

/* ─── SAVE PROFILE ─── */
async function saveProfile() {
  const btn = document.getElementById("pf-save-btn");
  btn.disabled    = true;
  btn.textContent = "Saving…";
  try {
    await apiFetch("/api/profile", {
      method: "PUT",
      body: {
        name:          document.getElementById("pf-name").value.trim(),
        institution:   document.getElementById("pf-institution").value.trim(),
        tovertafelId:  document.getElementById("pf-tover-id").value.trim(),
        country:       document.getElementById("pf-country").value.trim(),
      }
    });
    document.getElementById("user-name").textContent = document.getElementById("pf-name").value.trim() || document.getElementById("pf-username").value;
    document.getElementById("user-role").textContent = document.getElementById("pf-institution").value.trim() || "Tovertafel Dashboard";
    btn.textContent = "Saved ✓";
    btn.classList.add("saved");
    setTimeout(() => { btn.textContent = "Save profile"; btn.classList.remove("saved"); btn.disabled = false; }, 2200);
  } catch (err) {
    btn.textContent = "Error — try again";
    btn.disabled = false;
  }
}

/* ─── ENTRY POINT ─── */
window.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".auth-btn").forEach(b => { b.dataset.label = b.textContent; });

  // Check if the browser has a valid JWT cookie by hitting /api/me
  showLoadingScreen();
  try {
    const user = await apiFetch("/api/me");
    bootDashboard(user);
  } catch {
    // No valid session — show login
    hideLoadingScreen();
    showAuthScreen();
  }

  document.getElementById("login-password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("reg-confirm").addEventListener("keydown",    e => { if (e.key === "Enter") doRegister(); });
});

/* ============================================================
   GAME DATA
   ============================================================ */
const GAMES = [
  { name: "Leaves",             level: 2, tags: ["physical", "sensory"] },
  { name: "Beach",              level: 2, tags: ["physical", "sensory"] },
  { name: "Flowers",            level: 2, tags: ["physical", "social"]  },
  { name: "Space",              level: 2, tags: ["sensory",  "social"]  },
  { name: "Beach Ball",         level: 2, tags: ["physical", "social"]  },
  { name: "Fish",               level: 2, tags: ["sensory",  "social"]  },
  { name: "Butterflies",        level: 2, tags: ["physical", "sensory"] },
  { name: "Soap Bubbles",       level: 2, tags: ["physical", "sensory"] },
  { name: "Kites",              level: 2, tags: ["physical", "sensory"] },
  { name: "Bird Feeder",        level: 2, tags: ["sensory",  "social"]  },
  { name: "Spinning Tops",      level: 2, tags: ["sensory",  "social"]  },
  { name: "Evening Lights",     level: 2, tags: ["physical", "sensory"] },
  { name: "Baking Bread",       level: 3, tags: ["sensory",  "social"]  },
  { name: "Colourful Memories", level: 3, tags: ["sensory",  "social"]  },
  { name: "Travel Puzzle",      level: 3, tags: ["cognitive","social"]  },
  { name: "Masterpieces",       level: 3, tags: ["physical", "sensory"] },
  { name: "Nostalgia Puzzle",   level: 3, tags: ["cognitive","social"]  },
  { name: "Pairs",              level: 3, tags: ["cognitive","social"]  },
  { name: "Movement Dice",      level: 3, tags: ["physical", "social"]  },
  { name: "Birthday Cake",      level: 3, tags: ["sensory",  "social"]  },
  { name: "Watercolours",       level: 3, tags: ["physical", "sensory"] },
  { name: "Sayings",            level: 3, tags: ["cognitive","social"]  },
  { name: "Rhymes",             level: 3, tags: ["cognitive","social"]  },
  { name: "Music Box",          level: 3, tags: ["cognitive","social"]  },
  { name: "Sheet Music",        level: 3, tags: ["physical", "sensory"] },
  { name: "Kitchen Garden",     level: 3, tags: ["sensory",  "social"]  },
  { name: "Silverware",         level: 3, tags: ["physical", "social"]  },
  { name: "Wordsmith",          level: 4, tags: ["cognitive","social"]  },
  { name: "Sound Carousel",     level: 4, tags: ["cognitive","social"]  },
  { name: "Music Hits",         level: 4, tags: ["physical", "sensory"] },
  { name: "Balloon Party",      level: 4, tags: ["cognitive","social"]  },
  { name: "Mole Hunt",          level: 4, tags: ["physical", "social"]  },
  { name: "Marbles",            level: 4, tags: ["physical", "social"]  },
  { name: "Hobby Sets",         level: 4, tags: ["cognitive","social"]  },
  { name: "Sport Sets",         level: 4, tags: ["cognitive","social"]  },
  { name: "Football",           level: 4, tags: ["physical", "social"]  },
  { name: "Rummy",              level: 4, tags: ["cognitive","social"]  },
  { name: "Pool Table",         level: 5, tags: ["physical", "social"]  },
  { name: "Turning Tracks",     level: 5, tags: ["cognitive","social"]  },
  { name: "Leisure Memo",       level: 5, tags: ["cognitive","social"]  },
  { name: "Fly Swatter",        level: 5, tags: ["physical", "social"]  },
  { name: "Art Inspector",      level: 5, tags: ["cognitive","social"]  },
  { name: "Cash Register",      level: 5, tags: ["cognitive","social"]  },
  { name: "Luggage",            level: 5, tags: ["cognitive","social"]  },
  { name: "Sliding Puzzle",     level: 5, tags: ["cognitive","social"]  },
];

/* ============================================================
   SCORING CONSTANTS
   ============================================================ */
const TOD_BONUSES = {
  morning:   { physical: 2, social: 2, cognitive: 1, sensory: 0 },
  afternoon: { physical: 1, social: 2, cognitive: 2, sensory: 1 },
  evening:   { physical: 0, social: 1, cognitive: 0, sensory: 3 },
};
const TAG_CLASS   = { physical:"tag-phys", cognitive:"tag-cogn", sensory:"tag-sens", social:"tag-soc" };
const TAG_LABEL   = { physical:"Physical",  cognitive:"Cognitive", sensory:"Sensory",  social:"Social"  };
const LEVEL_CLASS = { 2:"lvl-2", 3:"lvl-3", 4:"lvl-4", 5:"lvl-5" };

let answers   = {};
let libFilter = "all";

/* ============================================================
   NAVIGATION
   ============================================================ */
function switchTab(tab, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("page-" + tab).classList.add("active");
  if (tab === "library") renderLib();
}

/* ============================================================
   RECOMMENDATION FORM
   ============================================================ */
function pick(key, val, btn) {
  answers[key] = val;
  btn.closest(".opt-list").querySelectorAll(".opt").forEach(o => o.classList.remove("sel"));
  btn.classList.add("sel");
  const allAnswered = ["level","goal","tod","social","mobility"].every(k => answers[k]);
  document.getElementById("btn-go").disabled = !allAnswered;
  document.getElementById("form-hint").textContent = allAnswered
    ? "Ready — click to see recommendations"
    : "Answer all 5 questions to continue";
}

function clearForm() {
  answers = {};
  document.querySelectorAll(".opt").forEach(o => o.classList.remove("sel"));
  document.getElementById("btn-go").disabled = true;
  document.getElementById("form-hint").textContent = "Answer all 5 questions to continue";
  document.getElementById("results-area").innerHTML = "";
}

/* ============================================================
   SCORING ALGORITHM — GOAL FIRST, LEVEL HARD FILTER + FALLBACK
   ============================================================ */
function scoreGame(game) {
  let score = 0;
  score += game.tags.includes(answers.goal) ? 50 : 10;
  const tod = TOD_BONUSES[answers.tod] || {};
  game.tags.forEach(t => { score += (tod[t] || 0); });
  if      (answers.social === "enjoys"    && game.tags.includes("social")) score += 10;
  else if (answers.social === "struggles" && game.tags.includes("social")) score -= 6;
  else if (answers.social === "neutral")                                    score += 3;
  if      (answers.mobility === "limited"  && game.tags.includes("physical")) score -= 5;
  else if (answers.mobility === "moderate" && game.tags.includes("physical")) score -= 2;
  return Math.max(0, score);
}

function buildReasons(game, isCrossLevel, crossLevel) {
  const reasons = [];
  const tod     = TOD_BONUSES[answers.tod] || {};
  if (game.tags.includes(answers.goal))
    reasons.push("Matches your goal: " + answers.goal);
  if (isCrossLevel)
    reasons.push("From Level " + crossLevel + " — no " + answers.goal + " game exists at the resident's level");
  if (game.tags.some(t => (tod[t] || 0) >= 2))
    reasons.push("Well suited for " + answers.tod + " sessions");
  if (answers.social === "enjoys" && game.tags.includes("social"))
    reasons.push("Matches social preference");
  if (answers.social === "struggles" && !game.tags.includes("social"))
    reasons.push("Suits individual play");
  if (answers.mobility !== "full" && !game.tags.includes("physical"))
    reasons.push("Low physical demand");
  return reasons.length ? reasons : ["Good overall match"];
}

function runRec() {
  const targetLevel = parseInt(answers.level);

  // Stage 1: hard filter — primary pool at exact level
  const primaryPool   = GAMES.filter(g => g.level === targetLevel);
  const primaryScored = primaryPool
    .map(g => ({ ...g, score: scoreGame(g), crossLevel: false, displayLevel: targetLevel }))
    .sort((a, b) => b.score - a.score);

  // Stage 2: check for goal matches in primary pool
  const primaryGoalMatches = primaryScored.filter(g => g.tags.includes(answers.goal));

  let fallbackScored = [];
  let fallbackLevel  = null;

  if (primaryGoalMatches.length === 0) {
    // No goal match at target level — find nearest level with a match
    const candidates = [];
    [targetLevel - 1, targetLevel + 1].forEach(lvl => {
      if (lvl < 2 || lvl > 5) return;
      const pool = GAMES.filter(g => g.level === lvl && g.tags.includes(answers.goal));
      if (pool.length > 0) candidates.push({ lvl, pool });
    });
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) =>
        Math.abs(a.lvl - targetLevel) <= Math.abs(b.lvl - targetLevel) ? a : b
      );
      fallbackLevel  = best.lvl;
      fallbackScored = best.pool
        .map(g => ({ ...g, score: scoreGame(g), crossLevel: true, displayLevel: best.lvl }))
        .sort((a, b) => b.score - a.score);
    }
  }

  // Stage 3: merge — primary first, then fallback to fill goal-matched slots
  const combined = [...primaryScored];
  for (const fb of fallbackScored) {
    if (combined.length >= 5) break;
    combined.push(fb);
  }
  const top5 = combined.slice(0, 5);

  // Normalise scores within each group separately
  const primaryMax  = primaryScored[0]?.score  || 1;
  const fallbackMax = fallbackScored[0]?.score || 1;
  top5.forEach(g => {
    g.pct = Math.round((g.score / (g.crossLevel ? fallbackMax : primaryMax)) * 100);
  });

  const hasCrossLevel = top5.some(g => g.crossLevel);
  const goalLabel = { cognitive:"Cognitive stimulation", physical:"Physical activity", social:"Social interaction", sensory:"Sensory stimulation" }[answers.goal];
  const todLabel  = { morning:"Morning", afternoon:"Afternoon", evening:"Evening" }[answers.tod];

  let html = `
    <div class="results-wrap">
      <div class="results-head">
        <div>
          <h3>Recommended games</h3>
          <p>Goal: ${goalLabel} · Level ${targetLevel} · ${todLabel}</p>
        </div>
        <div class="results-badge">Top ${top5.length} matches</div>
      </div>`;

  if (hasCrossLevel) {
    html += `
      <div class="results-notice">
        <span class="notice-icon">💡</span>
        No <strong>${answers.goal}</strong> games exist at Level ${targetLevel}.
        The closest match from Level ${fallbackLevel} is shown — check whether this level is appropriate before selecting.
      </div>`;
  }

  html += `<div class="results-body">`;
  top5.forEach((g, i) => {
    const reasons = buildReasons(g, g.crossLevel, g.displayLevel);
    html += `
      <div class="game-row${i === 0 ? " top1" : ""}${g.crossLevel ? " cross-level" : ""}">
        <div class="rank-circ${i === 0 ? " r1" : ""}">${i + 1}</div>
        <div>
          <div class="game-name">${g.name}
            ${g.crossLevel ? `<span class="level-badge ${LEVEL_CLASS[g.displayLevel]}">Level ${g.displayLevel}</span>` : ""}
          </div>
          <div class="tag-row">${g.tags.map(t => `<span class="tag ${TAG_CLASS[t]}">${TAG_LABEL[t]}</span>`).join("")}</div>
          <div class="game-why">${reasons.join(" · ")}</div>
        </div>
        <div class="score-col">
          <div class="score-pct">${g.pct}%</div>
          <div class="score-lbl">match</div>
          <div class="score-track"><div class="score-fill" style="width:${g.pct}%"></div></div>
        </div>
      </div>`;
  });
  html += `</div></div>`;
  document.getElementById("results-area").innerHTML = html;
  document.getElementById("results-area").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============================================================
   GAME LIBRARY
   ============================================================ */
function libPick(val, btn) {
  libFilter = val;
  document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("on"));
  btn.classList.add("on");
  renderLib();
}

function renderLib() {
  const filtered = GAMES.filter(g => {
    if (libFilter === "all") return true;
    if (["2","3","4","5"].includes(libFilter)) return g.level === parseInt(libFilter);
    return g.tags.includes(libFilter);
  });
  document.getElementById("lib-grid").innerHTML = filtered.map(g => `
    <div class="lib-card">
      <div class="lib-lvl ${LEVEL_CLASS[g.level]}">Level ${g.level}</div>
      <div class="lib-name">${g.name}</div>
      <div class="lib-tags">${g.tags.map(t => `<span class="tag ${TAG_CLASS[t]}">${TAG_LABEL[t]}</span>`).join("")}</div>
    </div>`).join("");
}
