/* COD Career — Warzone skill tracker
 *
 * Scoring:
 *   Every graded item (each skill + the final-death row) gets additions (+) and deductions (−).
 *   Match ELO change = (total additions − total deductions) / number of graded items.
 *   Graded items = SKILLS.length + 1 (final death). Add a skill below and the divisor grows with it.
 *   Each match stores the divisor it was scored with, so old matches never get re-scored.
 */

const STORAGE_KEY = 'cod-career-v1';
const START_ELO = 60;

const PROFILES = [
  { id: 'kolurin', name: 'Kolurin Zero' },
  { id: 'kuwolskii', name: 'Kuwolskii Zero' },
];

const SKILLS = [
  { id: 'centering', name: 'Centering',
    fix: 'Keep your crosshair at head height where enemies will appear — pre-aim corners and doorways before you peek.',
    keep: 'Crosshair placement was on point — keep pre-aiming angles.' },
  { id: 'pinging', name: 'Live pinging',
    fix: 'Ping every enemy, UAV and plate sound the moment you see/hear it. Call info before you shoot, not after.',
    keep: 'Great comms — the team always knew where the fight was.' },
  { id: 'rotation', name: 'Rotation planning',
    fix: 'Decide the next rotation before the circle closes — pick the route, cover, and vehicle ahead of time.',
    keep: 'Rotations were early and clean — keep moving before the gas forces you.' },
  { id: 'planning', name: 'General play planning',
    fix: 'Set a plan each phase: loadout timing, where to hold, when to push. Say it out loud to the squad.',
    keep: 'Game plan was clear and the squad stuck to it.' },
  { id: 'range', name: 'Range clocking',
    fix: 'Judge distance before engaging — only take fights at the range your current gun wins. Swap or reposition otherwise.',
    keep: 'Picked the right weapon for the range consistently.' },
  { id: 'aim', name: 'Aim',
    fix: 'Warm up before sessions and focus on tracking + recoil control. Burst at long range instead of full-auto.',
    keep: 'Gunfights were won on aim — stay warmed up.' },
  { id: 'movement', name: 'Movement mechanisms',
    fix: 'Never stand still in a fight: slide/jump-shot through cover, use mantles and strafe while reloading.',
    keep: 'Movement made you hard to hit — keep using it to reset fights.' },
  { id: 'awareness', name: '6th sense / acute awareness',
    fix: 'Check the minimap, listen for footsteps and plates, and expect third parties after every fight.',
    keep: 'Read the lobby well — you saw threats before they saw you.' },
];

const DEATH_ITEM = { id: 'death', name: 'Final death handling' };

const DEATHS = [
  { id: 'lowground', name: 'Low ground', fix: 'Fight for high ground or break line of sight — avoid taking fights from below.' },
  { id: 'outgunned', name: 'Out-gunned', fix: 'Pick fights your loadout wins; get your loadout earlier and check what the enemy is using.' },
  { id: 'lag', name: 'Lag', fix: 'Check connection/server before queueing — not a skill issue, but log it to spot patterns.' },
  { id: 'outnumbered', name: 'Out-numbered', fix: 'Don\'t take fights alone — group up, trade kills and disengage when the numbers are against you.' },
  { id: 'gas', name: 'Gas', fix: 'Rotate earlier and carry gas masks/self-revives; track the circle timer.' },
  { id: 'lethal', name: 'Lethal', fix: 'Respect lethals — move when you hear a throw, and carry a tactical/trophy for defence.' },
  { id: 'splat', name: 'Splat', fix: 'Deploy the chute earlier and watch altitude when jumping off buildings or vehicles.' },
  { id: 'gatekeep', name: 'Gatekeep', fix: 'Expect gatekeepers at chokepoints — rotate earlier or take an alternate route with cover.' },
];

const GRADED_ITEMS = [...SKILLS, DEATH_ITEM];

/* ---------- state ---------- */

function defaultState() {
  const profiles = {};
  PROFILES.forEach(p => { profiles[p.id] = { matches: [] }; });
  return { active: PROFILES[0].id, profiles };
}

function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
  if (!s || !s.profiles) s = defaultState();
  PROFILES.forEach(p => { if (!s.profiles[p.id]) s.profiles[p.id] = { matches: [] }; });
  if (!s.profiles[s.active]) s.active = PROFILES[0].id;
  return s;
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

let state = loadState();
let draft = newDraft();
let view = 'log';

function newDraft() {
  const scores = {};
  GRADED_ITEMS.forEach(i => { scores[i.id] = { add: 0, ded: 0, note: '' }; });
  return { scores, death: null };
}

const profile = () => state.profiles[state.active];
const profileName = id => PROFILES.find(p => p.id === id).name;

/* ---------- scoring ---------- */

function matchDelta(m) {
  let add = 0, ded = 0;
  Object.values(m.scores).forEach(s => { add += s.add; ded += s.ded; });
  return { add, ded, delta: (add - ded) / m.itemCount };
}

function eloSeries(matches) {
  const out = [START_ELO];
  matches.forEach(m => out.push(out[out.length - 1] + matchDelta(m).delta));
  return out;
}

const fmt = n => (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- summary (per match) ---------- */

function buildSummary(m) {
  const rows = SKILLS.filter(s => m.scores[s.id]).map(s => {
    const sc = m.scores[s.id];
    return { skill: s, net: sc.add - sc.ded, note: sc.note };
  });
  const weak = rows.filter(r => r.net < 0).sort((a, b) => a.net - b.net);
  const strong = rows.filter(r => r.net > 0).sort((a, b) => b.net - a.net);
  const death = DEATHS.find(d => d.id === m.death);

  const focus = weak.slice(0, 3).map(r => r.skill.fix);
  if (death && death.id !== 'lag') focus.push(`Avoid another ${death.name.toLowerCase()} death: ${death.fix}`);
  if (!focus.length) focus.push('Clean match — repeat the same habits and keep pinging and rotating early.');

  return { weak, strong, death, focus };
}

function summaryHTML(m, idx) {
  const { add, ded, delta } = matchDelta(m);
  const sum = buildSummary(m);
  const li = (r, text) => `<li><b>${esc(r.skill.name)}</b> <span class="${r.net < 0 ? 'down' : 'up'}">${signed(r.net)}</span> — ${esc(text)}${r.note ? `<br><span class="muted">Coach: ${esc(r.note)}</span>` : ''}</li>`;
  return `
    <div class="card summary">
      <div class="row-head">
        <div>
          <h2>Match ${idx + 1} summary ${m.label ? `· ${esc(m.label)}` : ''}</h2>
          <p class="muted">${new Date(m.date).toLocaleString()} · +${add} / −${ded} across ${m.itemCount} items</p>
        </div>
        <div class="elo-big ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}" style="font-size:28px">${signed(delta)}</div>
      </div>
      <div class="focus">
        <div class="elo-label">Do this next match</div>
        <ul>${sum.focus.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      </div>
      <div class="summary-grid">
        <div><div class="elo-label">What went wrong</div>
          ${sum.weak.length ? `<ul>${sum.weak.map(r => li(r, r.skill.fix)).join('')}</ul>` : '<p class="muted">No deductions on skills.</p>'}
        </div>
        <div><div class="elo-label">What went right</div>
          ${sum.strong.length ? `<ul>${sum.strong.map(r => li(r, r.skill.keep)).join('')}</ul>` : '<p class="muted">No additions on skills.</p>'}
        </div>
      </div>
      <p class="muted" style="margin-top:12px">Final death: <b>${sum.death ? esc(sum.death.name) : 'not logged'}</b>${m.scores.death && m.scores.death.note ? ` — ${esc(m.scores.death.note)}` : ''}</p>
    </div>`;
}

/* ---------- account stats ---------- */

function computeStats(matches) {
  const totals = {};
  SKILLS.forEach(s => { totals[s.id] = { add: 0, ded: 0, n: 0 }; });
  const deaths = {};
  DEATHS.forEach(d => { deaths[d.id] = 0; });
  matches.forEach(m => {
    SKILLS.forEach(s => {
      const sc = m.scores[s.id];
      if (!sc) return;
      totals[s.id].add += sc.add; totals[s.id].ded += sc.ded; totals[s.id].n++;
    });
    if (m.death && deaths[m.death] !== undefined) deaths[m.death]++;
  });
  const ranked = SKILLS.map(s => {
    const t = totals[s.id];
    return { skill: s, net: t.add - t.ded, avg: t.n ? (t.add - t.ded) / t.n : 0, add: t.add, ded: t.ded };
  });
  const lacking = ranked.slice().sort((a, b) => a.avg - b.avg || b.ded - a.ded).slice(0, 3);
  const best = ranked.slice().sort((a, b) => b.avg - a.avg || b.add - a.add).slice(0, 3);
  const deathList = DEATHS.map(d => ({ d, count: deaths[d.id] })).sort((a, b) => b.count - a.count);
  return { lacking, best, deathList };
}

function sparkline(series) {
  if (series.length < 2) return '';
  const w = 600, h = 80, pad = 6;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => [pad + i * (w - 2 * pad) / (series.length - 1), h - pad - (v - min) * (h - 2 * pad) / span]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="ELO over time">
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="var(--accent)"/></svg>`;
}

/* ---------- rendering ---------- */

function renderProfiles() {
  const el = document.getElementById('profileSwitch');
  el.innerHTML = PROFILES.map(p => `<button role="tab" data-profile="${p.id}" class="${p.id === state.active ? 'active' : ''}">${esc(p.name)}</button>`).join('');
}

function renderElo() {
  const ms = profile().matches;
  const series = eloSeries(ms);
  const elo = series[series.length - 1];
  const last = ms.length ? matchDelta(ms[ms.length - 1]).delta : 0;
  const best = Math.max(...series);
  document.getElementById('eloStrip').innerHTML = `
    <div>
      <div class="elo-label">${esc(profileName(state.active))} · Warzone ELO</div>
      <div class="elo-big">${fmt(elo)}</div>
    </div>
    <div class="elo-meta">
      <div><span class="elo-label">Last match</span><b class="${last > 0 ? 'up' : last < 0 ? 'down' : ''}">${ms.length ? signed(last) : '—'}</b></div>
      <div><span class="elo-label">Peak</span><b>${fmt(best)}</b></div>
      <div><span class="elo-label">Matches</span><b>${ms.length}</b></div>
    </div>`;
}

function counterHTML(id) {
  const sc = draft.scores[id];
  return `<button class="minus" data-act="ded" data-id="${id}" aria-label="Deduction">−</button>
    <div class="tally"><b><span class="up">+${sc.add}</span> / <span class="down">−${sc.ded}</span></b></div>
    <button class="plus" data-act="add" data-id="${id}" aria-label="Addition">+</button>`;
}

function renderLog() {
  document.getElementById('skillRows').innerHTML = SKILLS.map(s => `
    <div class="skill-row">
      <div class="row-head"><h3>${esc(s.name)}</h3><div class="counter" id="c-${s.id}">${counterHTML(s.id)}</div></div>
      <input class="note" data-note="${s.id}" placeholder="Coach note (optional)" value="${esc(draft.scores[s.id].note)}">
    </div>`).join('');
  document.getElementById('deathCounter').innerHTML = counterHTML('death');
  document.getElementById('deathChips').innerHTML = DEATHS.map(d =>
    `<button class="chip ${draft.death === d.id ? 'active' : ''}" data-death="${d.id}">${esc(d.name)}</button>`).join('');
  document.getElementById('deathNote').value = draft.scores.death.note;
  renderPreview();
}

function refreshCounter(id) {
  const el = document.getElementById(id === 'death' ? 'deathCounter' : 'c-' + id);
  if (el) el.innerHTML = counterHTML(id);
  renderPreview();
}

function renderPreview() {
  const { add, ded, delta } = matchDelta({ scores: draft.scores, itemCount: GRADED_ITEMS.length });
  document.getElementById('livePreview').innerHTML =
    `ELO change: <b class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${signed(delta)}</b> <span class="muted">(${add} − ${ded}) ÷ ${GRADED_ITEMS.length}</span>`;
}

function renderHistory() {
  const ms = profile().matches;
  const el = document.getElementById('historyList');
  if (!ms.length) { el.innerHTML = '<div class="card empty">No matches logged yet for this profile.</div>'; return; }
  const series = eloSeries(ms);
  el.innerHTML = ms.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => {
    const { delta } = matchDelta(m);
    const death = DEATHS.find(d => d.id === m.death);
    const rows = GRADED_ITEMS.filter(it => m.scores[it.id]).map(it => {
      const sc = m.scores[it.id];
      return `<tr><td>${esc(it.name)}</td><td class="num up">+${sc.add}</td><td class="num down">−${sc.ded}</td><td class="num">${signed(sc.add - sc.ded)}</td></tr>`;
    }).join('');
    return `
      <details class="card match-item">
        <summary>
          <div>
            <div class="title">Match ${i + 1}${m.label ? ' · ' + esc(m.label) : ''}</div>
            <div class="muted">${new Date(m.date).toLocaleDateString()}${m.placement ? ' · #' + esc(m.placement) : ''}${m.kills !== '' && m.kills != null ? ' · ' + esc(m.kills) + ' kills' : ''} · ${death ? esc(death.name) : 'no death logged'}</div>
          </div>
          <div style="text-align:right">
            <b class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${signed(delta)}</b>
            <div class="muted">ELO ${fmt(series[i + 1])}</div>
          </div>
        </summary>
        ${summaryHTML(m, i)}
        <table class="breakdown"><thead><tr><th>Item</th><th class="num">Adds</th><th class="num">Deds</th><th class="num">Net</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="actions" style="margin-top:12px"><button class="btn danger" data-delete="${m.id}">Delete match</button></div>
      </details>`;
  }).join('');
}

function renderStats() {
  const ms = profile().matches;
  const el = document.getElementById('statsBody');
  if (!ms.length) { el.innerHTML = '<div class="card empty">Log a match to see account stats.</div>'; return; }
  const st = computeStats(ms);
  const maxDeath = Math.max(1, ...st.deathList.map(x => x.count));
  const totalDeaths = st.deathList.reduce((a, x) => a + x.count, 0);
  const rank = list => `<ol class="rank-list">${list.map((r, i) =>
    `<li><span>${i + 1}. ${esc(r.skill.name)}</span><span class="${r.avg > 0 ? 'up' : r.avg < 0 ? 'down' : ''}">${signed(r.avg)}/match <span class="muted">(+${r.add} / −${r.ded})</span></span></li>`).join('')}</ol>`;
  el.innerHTML = `
    <div class="card">
      <div class="elo-label">ELO trend</div>
      ${sparkline(eloSeries(ms))}
    </div>
    <div class="stats-grid">
      <div class="card">
        <h3>Top 3 areas lacking</h3>
        ${rank(st.lacking)}
        <div class="focus"><div class="elo-label">Work on</div><p class="muted">${esc(st.lacking[0].skill.fix)}</p></div>
      </div>
      <div class="card">
        <h3>Top 3 best areas</h3>
        ${rank(st.best)}
      </div>
    </div>
    <div class="card">
      <h3>Most common manner of death</h3>
      ${totalDeaths ? `<p class="muted">Most often: <b>${esc(st.deathList[0].d.name)}</b> — ${esc(st.deathList[0].d.fix)}</p>` : '<p class="muted">No death reasons logged yet.</p>'}
      ${st.deathList.map(x => `
        <div class="bar-row"><span>${esc(x.d.name)}</span>
          <div class="bar"><span style="width:${(x.count / maxDeath) * 100}%;background:var(--bad)"></span></div>
          <span class="muted">${x.count}</span></div>`).join('')}
    </div>`;
}

function renderAll() {
  renderProfiles();
  renderElo();
  renderLog();
  renderHistory();
  renderStats();
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
}

/* ---------- events ---------- */

document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.dataset.profile) {
    state.active = t.dataset.profile; saveState();
    draft = newDraft(); document.getElementById('lastSummary').innerHTML = '';
    renderAll(); return;
  }
  if (t.dataset.view) { view = t.dataset.view; renderAll(); return; }
  if (t.dataset.act) {
    draft.scores[t.dataset.id][t.dataset.act]++;
    refreshCounter(t.dataset.id); return;
  }
  if (t.dataset.death) {
    draft.death = draft.death === t.dataset.death ? null : t.dataset.death;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.death === draft.death));
    return;
  }
  if (t.dataset.delete) {
    if (!confirm('Delete this match? ELO will be recalculated.')) return;
    profile().matches = profile().matches.filter(m => m.id !== t.dataset.delete);
    saveState(); renderAll(); return;
  }
});

document.addEventListener('input', e => {
  if (e.target.dataset.note) draft.scores[e.target.dataset.note].note = e.target.value;
  if (e.target.id === 'deathNote') draft.scores.death.note = e.target.value;
});

document.addEventListener('contextmenu', e => {
  // Right-click (or long-press) a +/− button to undo one tap.
  const t = e.target.closest('button[data-act]');
  if (!t) return;
  e.preventDefault();
  const sc = draft.scores[t.dataset.id];
  if (sc[t.dataset.act] > 0) sc[t.dataset.act]--;
  refreshCounter(t.dataset.id);
});

document.getElementById('resetLog').addEventListener('click', () => {
  draft = newDraft();
  ['matchLabel', 'matchPlacement', 'matchKills'].forEach(id => { document.getElementById(id).value = ''; });
  renderLog();
});

document.getElementById('saveMatch').addEventListener('click', () => {
  const touched = Object.values(draft.scores).some(s => s.add || s.ded) || draft.death;
  if (!touched && !confirm('Nothing graded yet. Save an empty match anyway?')) return;
  const m = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    mode: 'warzone',
    label: document.getElementById('matchLabel').value.trim(),
    placement: document.getElementById('matchPlacement').value,
    kills: document.getElementById('matchKills').value,
    scores: JSON.parse(JSON.stringify(draft.scores)),
    death: draft.death,
    itemCount: GRADED_ITEMS.length,
  };
  profile().matches.push(m);
  saveState();
  draft = newDraft();
  ['matchLabel', 'matchPlacement', 'matchKills'].forEach(id => { document.getElementById(id).value = ''; });
  renderAll();
  document.getElementById('lastSummary').innerHTML = summaryHTML(m, profile().matches.length - 1);
  document.getElementById('lastSummary').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cod-career-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(txt => {
    const data = JSON.parse(txt);
    if (!data.profiles) throw new Error('bad file');
    if (!confirm('Replace current data with this file?')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    state = loadState(); renderAll();
  }).catch(() => alert('That file is not a COD Career export.'));
  e.target.value = '';
});

document.getElementById('resetProfile').addEventListener('click', () => {
  if (!confirm(`Delete all matches for ${profileName(state.active)}? ELO resets to ${START_ELO}.`)) return;
  profile().matches = []; saveState(); renderAll();
});

renderAll();
