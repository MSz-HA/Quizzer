// @ts-check
// TV screen: lobby with QR code, then questions, reveals and final scores
import { $, esc, t, num, loadInfo, shape, avatar, suggestedBy, startTimer, stopTimer, send, connect, fsSupported, goFullscreen, isSprint, roundSize } from './common.js';

/** @typedef {import('./types').ServerMsg} ServerMsg */
/** @typedef {import('./types').QuestionMsg} QuestionMsg */
/** @typedef {import('./types').RevealMsg} RevealMsg */
/** @typedef {import('./types').ScoresMsg} ScoresMsg */
/** @typedef {import('./types').Info} Info */
/** @typedef {import('./types').Player} Player */
/** @typedef {import('./types').Score} Score */
/** @typedef {import('./types').Settings} Settings */
/** @typedef {import('./types').SetupMsg} SetupMsg */
/** @typedef {import('./types').VoteMsg} VoteMsg */
/** @typedef {import('./types').PickMsg} PickMsg */
/** @typedef {import('./types').RoundEndMsg} RoundEndMsg */
/** @typedef {import('./types').RoundInfo} RoundInfo */
/** @typedef {import('./types').Award} Award */
/** @typedef {import('./types').SortItem} SortItem */
/** @typedef {import('./types').CompareItem} CompareItem */

const app = /** @type {HTMLElement} */ ($('app'));
/** @type {Partial<Info>} */
let info = {};
/** @type {Player[]} */
let players = [];
/** Current settings, as last sent by the server @type {Settings | null} */
let settings = null;
/** @type {QuestionMsg | null} */
let cur = null;
/** Scores and ranking after the previous reveal, to animate the leaderboard. @type {Score[]} */
let prev = [];
const ROW = 102; // leaderboard row height + gap, see .lbrow in host.css
/** Players already shown as answered, so only new answers pop. @type {Set<string>} */
let answered = new Set();

/** @param {string} id @param {string} html */
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
/** @param {string} id @param {string} text */
const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

// Everything is laid out on a 1920x1080 stage, scaled to fit the screen
function fit() { document.documentElement.style.setProperty('--s', String(Math.min(innerWidth / 1920, innerHeight / 1080))); }
addEventListener('resize', fit);
fit();

const fsBtn = () => fsSupported()
  ? `<button class="btn alt fsbtn" data-action="fullscreen"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,9 4,4 9,4"/><polyline points="15,4 20,4 20,9"/><polyline points="20,15 20,20 15,20"/><polyline points="9,20 4,20 4,15"/></svg>${t('fullscreen')}</button>` : '';
/** @param {number} size */
function ring(size) {
  const r = size / 2 - 8, c = (2 * Math.PI * r).toFixed(1);
  return `<div class="ringbox" style="width:${size}px;height:${size}px"><svg class="ring" width="${size}" height="${size}" aria-hidden="true">
    <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="14"/>
    <circle class="left" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="14" stroke-dasharray="${c}" data-ring="${c}"/></svg><b data-t></b></div>`;
}
/** @param {string[]} list */
const chips = list => list.map(n => `<div class="chip pop">${esc(n)}</div>`).join('');
const FLAME = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1.2 4 6.5 6.5 6.5 13a6.5 6.5 0 0 1-13 0c0-2.6 1-4.4 2.6-5.8.3 2 1.3 3.3 2.6 3.8C10.7 7.4 10.2 4.6 12 1z"/></svg>';
/** Flame + count for 3+ correct answers in a row @param {number} n */
const streak = n => n >= 3 ? `<span class="streak">${FLAME}${n}</span>` : '';
/** "Round 2/3 · " in multi-round games @param {RoundInfo} m */
const roundPrefix = m => m.rounds > 1 ? `${t('round_short', { n: m.round, total: m.rounds })} · ` : '';
/** @param {QuestionMsg} m */
const qPills = m => `<div class="row"><span class="chip pill gold">${esc(m.category)}</span>${m.subject ? `<span class="chip pill subj">${avatar(m.subject, 40)}${esc(m.subject.name)}</span>` : ''}<span class="muted">${roundPrefix(m)}${m.kind === 'classic' || m.kind === 'about' ? '' : `${t('k_' + m.kind)}${isSprint(m.kind) ? '' : ' · '}`}${isSprint(m.kind) ? '' : t('qn', { n: m.n, total: m.total })}</span></div>`;
/** @param {number} v seconds */
const secs = v => v >= 60 && v % 60 === 0 ? t('mins', { n: v / 60 }) : t('secs', { n: v });
const check = '<svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="fill:none"><polyline points="4,12.5 9.5,18 20,6.5"/></svg>';

function lobby() {
  const p = players, host = (info.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  app.innerHTML = `<div class="top" style="min-height:0">
      <div class="brand"><div class="logo">Q</div>Quizzer</div>
      <div class="row"><span class="muted">${t('tagline')}</span>${fsBtn()}</div></div>
    <div class="lobby">
      <section class="joincard">
        <h2>${t('scan')}</h2>
        <img class="qr" src="${info.qr}" alt="QR code">
        <div class="url">${esc(host)}</div>
        <p class="muted">${t('wifi')}</p>
      </section>
      <section class="players">
        <div class="row" style="align-items:baseline;gap:20px"><h2>${t('players')}</h2>
          <span class="muted big">${p.length ? t('joined', { n: p.length }) : t('waiting_players')}</span></div>
        <div class="pgrid${p.length > 12 ? ' dense' : ''}">${p.map(pl => `<div class="pcard pop">${avatar(pl, p.length > 12 ? 48 : 64)}<span>${esc(pl.name)}</span></div>`).join('')}</div>
        <div class="grow"></div>
        <div class="row">
          <div class="col" style="gap:8px"><span class="muted">${settings ? t('game_summary', { rounds: settings.rounds, per: settings.per_round }) : ''}</span>
            <button class="btn alt fsbtn" data-action="setup" style="align-self:flex-start">${t('settings')}</button></div>
          <div class="grow"></div>
          <button class="btn big" ${p.length ? '' : 'disabled'} data-action="start">${t('start')}</button></div>
      </section>
    </div>`;
}

/** "New game" screen: the host picks settings, then opens the lobby. @param {SetupMsg} m */
function setup(m) {
  const st = m.settings, o = m.options, scroll = app.querySelector('.settings')?.scrollTop ?? 0;
  /** @param {string} key @param {string} label @param {{ v: string, label: string, on: boolean }[]} choices */
  const row = (key, label, choices) => `<div class="srow"><span class="slabel">${label}</span><div class="row">${choices.map(c =>
    `<button class="count${c.on ? ' on' : ''}" data-action="set" data-k="${key}" data-v="${c.v}" aria-pressed="${c.on}">${c.label}</button>`).join('')}</div></div>`;
  /** @param {'rounds' | 'per_round' | 'suggest_seconds' | 'category_seconds' | 'question_seconds'} key @param {(v: number) => string} fmt */
  const nums = (key, fmt) => o[key].map(v => ({ v: String(v), label: fmt(v), on: v === st[key] }));
  const total = st.rounds * st.per_round, types = st.types.slice(0, st.rounds);
  /** Answer time + reveal per question; a sprint is one 60 s set @param {string} k */
  const play = k => isSprint(k) ? 75 : st.per_round * ((k === 'truefalse' ? Math.max(5, st.question_seconds / 2) : st.question_seconds) + 7);
  // Rough upper bound: suggestions + tidying once, vote + generation per round, playing the round, standings between rounds
  const minutes = Math.ceil((st.suggest_seconds + 10 + st.rounds * (st.category_seconds + 20) + types.reduce((a, k) => a + play(k), 0) + (st.rounds - 1) * 8) / 60);
  app.innerHTML = `<div class="top" style="min-height:0">
      <div class="brand"><div class="logo">Q</div>Quizzer</div>${fsBtn()}</div>
    <div class="setup">
      <section class="settings">
        <h2>${t('new_game')}</h2>
        ${row('rounds', t('s_rounds'), nums('rounds', String))}
        ${row('per_round', t('s_per_round'), nums('per_round', String))}
        ${types.map((k, r) => row(`type${r}`, t('s_type', { n: r + 1 }), m.types.map(v => ({ v, label: t('k_' + v), on: v === k })))).join('')}
        ${row('suggest_seconds', t('s_suggest_time'), nums('suggest_seconds', secs))}
        ${row('category_seconds', t('s_cat_time'), nums('category_seconds', secs))}
        ${row('question_seconds', t('s_q_time'), nums('question_seconds', secs))}
        ${row('avatars', t('s_avatars'), [{ v: 'true', label: t('on'), on: st.avatars }, { v: 'false', label: t('off'), on: !st.avatars }])}
        ${row('ai_awards', t('s_awards'), [{ v: 'false', label: t('aw_templates'), on: !st.ai_awards }, { v: 'true', label: t('aw_claude'), on: st.ai_awards }])}
      </section>
      <aside class="summary">
        <div class="bignum">${st.rounds} × ${st.per_round}</div>
        <p class="big">${t('total_q', { n: total })}</p>
        <p class="muted">${t('duration', { n: minutes })}</p>
        <div class="grow"></div>
        ${m.players ? `<p class="muted">${t('phones', { n: m.players })}</p>` : ''}
        <button class="btn big" data-action="open">${t('open_lobby')}</button>
      </aside>
    </div>`;
  const list = app.querySelector('.settings');
  if (list) list.scrollTop = scroll;  // re-rendered on every change; keep the host's place in the list
}

/** "Round 2 of 3 · 5 questions" pill above the vote @param {VoteMsg | PickMsg} m */
const votePill = m => `<span class="chip pill">${m.rounds > 1 ? `${t('round_of', { n: m.round, total: m.rounds })} · ` : ''}${roundSize(m)}</span>`;

/** Category vote in the answer colours and shapes the phones use. The result shows each choice's votes
 * and highlights the winner. @param {VoteMsg | PickMsg} m */
function voteBoard(m) {
  const res = 'counts' in m ? m : null;
  const tie = !!res && res.counts.filter(n => n === Math.max(...res.counts)).length > 1;
  const cards = m.options.map((o, i) => `<div class="ans a${i} ${!res ? 'pop' : o === res.chosen ? 'won' : 'dim'}${o.length > 26 ? ' long' : ''}" style="animation-delay:${i * 80}ms">
    <span class="badge">${shape(i, 44)}</span><span class="grow">${esc(o)}</span>${suggestedBy(m.by[i], 64)}${res ? `<b class="vcount">${res.counts[i]}</b>` : ''}</div>`).join('');
  app.innerHTML = `<div class="top">${votePill(m)}${res ? '' : ring(132)}</div>
    <div class="col center" style="justify-content:flex-start;padding-top:20px;gap:48px">
      <h1 class="huge${res ? ' pop' : ''}">${res ? esc(res.chosen) : t('vote_tv')}</h1>
      <div class="agrid vote">${cards}</div>
      ${res ? `<p class="muted big">${tie ? `${t('tie')} · ` : ''}${isSprint(m.kind) ? t('writing_q') : t('writing_n', { n: m.total })}</p>`
        : `<div class="row" style="gap:20px"><div class="bar wide"><i id="vbar" style="width:0"></i></div>
          <b class="big" id="vn">${t('voted_n', { n: 0, total: 'players' in m ? m.players : 0 })}</b></div>`}</div>`;
}

/** Standings between rounds. @param {RoundEndMsg} m */
function roundEnd(m) {
  const rows = m.scores.slice(0, 6).map((s, i) => `<div class="lbrow${i === 0 ? ' first' : ''} pop" style="animation-delay:${i * 80}ms">
    <span class="rk">${i + 1}</span><span class="av">${avatar(s, 52)}${streak(s.streak)}</span><span class="nm">${esc(s.name)}</span>
    <span class="sc">${num(s.score)}</span></div>`).join('');
  app.innerHTML = `<div class="col center" style="justify-content:flex-start;gap:24px">
    <h1 class="huge">${t('round_done', { n: m.round })}</h1>
    <p class="muted big">${t('next_round', { n: m.round + 1, total: m.rounds })}</p>
    <div class="standings">${rows}</div>
    <p class="muted">${t('hold_tv')}</p></div>`;
  prev = m.scores;
}

/** The question; in sprints also the buckets (sort) and everyone's live progress, filled in by 'answered'. @param {QuestionMsg} m */
function question(m) {
  const size = m.text.length > 90 ? 's' : m.text.length > 60 ? 'm' : '';
  const sprint = isSprint(m.kind) ? `<div class="sprint">
      ${m.buckets ? `<div class="row buckets">${m.buckets.map((b, i) => `<span class="ans a${i ? 3 : 0}">${esc(b)}</span>`).join('<span class="muted">/</span>')}</div>` : ''}
      <p class="muted big">${t('play_phone')}</p><div class="prog" id="prog"></div></div>` : '';
  app.innerHTML = `<div class="top">${qPills(m)}${ring(132)}</div>
    <div class="qtext${sprint ? ' short' : ''}">${m.subject ? `<div class="spot">${avatar(m.subject, 150, 'pop')}<b>${esc(m.subject.name)}</b></div>` : ''}<h1 class="${size}">${esc(m.text)}</h1></div>
    ${sprint || '<div class="row"><div class="who" id="who"></div><span class="muted" id="ans"></span></div>'}`;
  startTimer(m.seconds, m.lock);
}

/** Sprint progress: a bar per player. @param {(Player & { done: boolean, n?: number })[]} ps */
function progress(ps) {
  const of = cur?.key?.length || 1;
  setHTML('prog', ps.map(p => `<div class="prow">${avatar(p, 52)}<span class="nm">${esc(p.name)}</span>
    <div class="bar"><i style="width:${(p.n || 0) / of * 100}%"></i></div><b>${p.n || 0}/${of}</b></div>`).join(''));
}

/** @param {QuestionMsg} q @param {RevealMsg} m */
function reveal(q, m) {
  stopTimer();
  // Rows start at their previous rank with the old score, then slide into place (see animateBoard)
  const rows = m.scores.slice(0, 5).map((s, i) => {
    const before = prev.findIndex(p => p.name === s.name), old = before < 0 ? 0 : prev[before].score;
    const from = prev.length ? Math.min(before < 0 ? 5 : before, 5) : i, d = s.score - old;
    return `<div class="lbrow${i === 0 ? ' first' : ''}" style="transform:translateY(${(from - i) * ROW}px);opacity:${from > 4 ? 0 : 1}">
      <span class="rk">${i + 1}</span><span class="av">${avatar(s, 52)}${streak(s.streak)}</span><span class="nm">${esc(s.name)}</span>
      <span class="dl hide${d ? '' : ' zero'}">+${num(d)}</span><span class="sc" data-old="${old}" data-new="${s.score}">${num(old)}</span></div>`;
  }).join('');
  prev = m.scores;
  app.innerHTML = `${qPills(q)}
    <h1 class="qsmall">${esc(q.text)}</h1>
    <div class="rv">
      <div class="col grow">
        ${answerBox(q, m)}
        ${m.explanation ? `<div class="explain"><svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#FFC83D" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><line x1="12" y1="7.5" x2="12" y2="7.6"/></svg><p>${esc(m.explanation)}</p></div>` : ''}
      </div>
      <aside class="lb"><h2>${t('leaderboard')}</h2>${rows}<div class="grow"></div><p class="muted holdtv">${t('hold_tv')}</p></aside>
    </div>`;
  setTimeout(animateBoard, 900);
}

/** The right answer and how everyone did, per round type. @param {QuestionMsg} q @param {RevealMsg} m */
function answerBox(q, m) {
  if (m.kind === 'number' && m.answer !== undefined) {
    const unit = m.unit ? ` ${esc(m.unit)}` : '';
    return `<div class="numans pop">${num(m.answer)}${unit}</div>
      <h2 class="sub">${t('guesses')}</h2>
      <div class="guesses">${(m.guesses || []).slice(0, 6).map((g, i) => `<div class="lbrow${i === 0 || g.value === m.answer ? ' first' : ''}">${avatar(g, 52)}
        <span class="nm">${esc(g.name)}</span><span class="sc">${num(g.value)}${unit}</span><span class="dl">+${num(g.delta)}</span></div>`).join('')}</div>`;
  }
  if (m.kind === 'order' && m.order && m.values && m.placed) {
    const placed = m.placed, values = m.values;
    return `<h2 class="sub">${t('right_order')}</h2>
      <div class="olist">${m.order.map((o, k) => `<div class="ans a${o} pop" style="animation-delay:${k * 120}ms"><b class="pos">${k + 1}</b>
        <span class="grow">${esc(q.options[o])}</span><span class="val">${esc(values[k])}</span><span class="votes">${placed[o]} ✓</span></div>`).join('')}</div>`;
  }
  if (isSprint(m.kind) && m.right && q.items) {
    // Every item in two columns with how many players got it right; ones most players missed are marked
    const right = m.right, of = m.players || 1;
    /** @param {string} text @param {number | null} r players who got it right @param {string} label @param {string} cls */
    const cell = (text, r, label, cls) => `<div class="cell ${cls}${r !== null && r / of < .5 ? ' miss' : ''}"><span class="grow">${esc(text)}</span>
      ${label ? `<span class="val">${esc(label)}</span>` : ''}<b>${r === null ? '' : `${r}/${of}`}</b></div>`;
    /** @param {string[]} cells */
    const grid = cells => `<div class="cells" style="grid-template-rows:repeat(${Math.ceil(cells.length / 2)},auto)">${cells.join('')}</div>`;
    if (q.kind === 'sort' && q.buckets) {
      const items = /** @type {SortItem[]} */ (q.items), byBucket = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.bucket - b.bucket);
      return `<div class="row buckets small">${q.buckets.map((b, k) => `<span class="ans a${k ? 3 : 0}">${esc(b)}</span>`).join('')}</div>
        ${grid(byBucket.map(it => cell(it.text, right[it.i], '', `a${it.bucket ? 3 : 0}`)))}`;
    }
    // Compare: the chain in play order; each item after the first shows how many got its pair right
    const items = /** @type {CompareItem[]} */ (q.items);
    return grid(items.map((it, i) => cell(it.text, i ? right[i - 1] : null, it.label, '')));
  }
  const counts = m.counts || [], votes = Math.max(1, counts.reduce((a, b) => a + b, 0));
  return `<div class="agrid">${q.options.map((o, i) => `<div class="ans a${i} ${i === m.correct ? 'right pop' : 'dim'}${o.length > 26 ? ' long' : ''}">
    <div class="row">${shape(i, 36)}<span class="grow">${esc(o)}</span>${i === m.correct ? check : ''}</div>
    <div class="row"><div class="vbar"><i style="width:${(counts[i] || 0) / votes * 100}%"></i></div><span class="votes">${counts[i] || 0}</span></div></div>`).join('')}</div>`;
}

function animateBoard() {
  app.querySelectorAll('.lbrow').forEach(el => {
    const row = /** @type {HTMLElement} */ (el);
    row.classList.add('move');
    row.style.transform = '';
    row.style.opacity = '';
  });
  app.querySelectorAll('.lb .dl').forEach(el => el.classList.remove('hide'));
  app.querySelectorAll('.lb .sc').forEach(el => {
    const sc = /** @type {HTMLElement} */ (el), from = Number(sc.dataset.old), to = Number(sc.dataset.new), t0 = performance.now();
    /** @param {number} now */
    const step = now => {
      const k = Math.min(1, (now - t0) / 800);
      sc.textContent = num(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Podium for the top 3 with confetti, everyone else in a short list. @param {ScoresMsg} m */
function final(m) {
  const [winner] = m.scores;
  if (!winner) return;
  const colors = ['#FFC83D', '#5EEAD4', '#FF8A80', '#93A8FF', '#F0A6FF', '#A7F3A0'];
  const confetti = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};
    animation-delay:${Math.random() * 2.5}s;animation-duration:${3 + Math.random() * 3}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  const podium = [1, 0, 2].filter(i => m.scores[i]).map(i => {
    const s = m.scores[i];
    return `<div class="pod p${i + 1}">${avatar(s, i === 0 ? 180 : 140, 'pop')}
      <div class="pname">${esc(s.name)}</div><div class="pscore">${num(s.score)} ${streak(s.best)}</div>
      <div class="block">${i + 1}</div></div>`;
  }).join('');
  const others = m.scores.slice(3, 8).map((s, i) => `<div class="lbrow"><span class="rk">${i + 4}</span>${avatar(s, 44)}
    <span class="nm">${esc(s.name)}</span><span class="sc">${num(s.score)}</span></div>`).join('');
  app.innerHTML = `<div class="fin">
    <div class="confetti" aria-hidden="true">${confetti}</div>
    <button class="btn alt again" data-action="setup">${t('play_again')}</button>
    <h1 class="huge">${t('wins', { name: esc(winner.name) })}</h1>
    <p class="muted big">${t('win_sub', { score: num(winner.score), correct: winner.correct, total: m.questions, best: winner.best })}</p>
    <div class="podium">${podium}</div>
    ${others ? `<div class="others">${others}</div>` : ''}
    ${(m.awards || []).map(bubble).join('')}
  </div>`;
}

/** An award as a comic bubble floating beside the podium, slot n in host.css. @param {Award} a @param {number} n */
const bubble = (a, n) => `<div class="bubble b${n}" style="--d:${2.2 + n * .7}s">
  <div class="btext"><b>${esc(a.icon)} ${esc(a.title)}</b>${esc(a.text)}</div></div>`;

/** @param {ServerMsg} m */
function on(m) {
  switch (m.type) {
    case 'setup': stopTimer(); settings = m.settings; setup(m); break;
    case 'lobby': stopTimer(); players = m.players; settings = m.settings; lobby(); break;
    case 'categories':
      prev = [];
      app.innerHTML = `<div class="top"><span class="chip pill">${settings ? t('game_summary', { rounds: settings.rounds, per: settings.per_round }) : ''}</span>${ring(140)}</div>
        <div class="col center" style="justify-content:flex-start;padding-top:40px">
          <h1 class="huge">${t('pick_cat')}</h1>
          <p class="muted big" id="csub">${t('drawn')}</p>
          <div class="row" style="gap:20px"><div class="bar wide"><i id="cbar" style="width:0"></i></div>
            <b class="big" id="cn">${t('sent_n', { n: 0, total: m.players })}</b></div>
          <div class="chips" id="cl"></div></div>`;
      startTimer(m.seconds);
      break;
    case 'preparing': stopTimer(); setText('csub', t('preparing')); break;
    case 'vote': voteBoard(m); startTimer(m.seconds); break;
    case 'votes': {
      setText('vn', t('voted_n', { n: m.voted, total: m.players }));
      const bar = $('vbar');
      if (bar) bar.style.width = m.voted / Math.max(1, m.players) * 100 + '%';
      break;
    }
    case 'pick': stopTimer(); voteBoard(m); break;
    case 'cats': {
      setHTML('cl', chips(m.list));
      setText('cn', t('sent_n', { n: m.submitted, total: m.players }));
      const bar = $('cbar');
      if (bar) bar.style.width = m.submitted / Math.max(1, m.players) * 100 + '%';
      break;
    }
    case 'generating':
      stopTimer();
      app.innerHTML = `<div class="col center">
        <h1 class="huge">${isSprint(m.kind) ? t('k_' + m.kind) : t('writing', { n: m.total })}</h1>
        <div class="chips">${chips(m.categories)}</div>
        <div class="bar wide"><i id="pg" style="width:4%"></i></div>
        <p class="muted big" id="pgt"></p></div>`;
      break;
    case 'progress': {
      const bar = $('pg');
      if (bar) bar.style.width = m.done / m.total * 100 + '%';
      setText('pgt', t('batches', { n: m.done, total: m.total }));
      break;
    }
    case 'ready':
      app.innerHTML = `<div class="top"><span class="chip pill">${m.rounds > 1 ? `${t('round_of', { n: m.round, total: m.rounds })} · ` : ''}${roundSize(m)}</span></div>
        <div class="col center"><h1 class="huge pop">${esc(m.category)}</h1>
          <p class="rule pop"><b>${t('k_' + m.kind)}</b>${t('r_' + m.kind)}</p><p class="muted big">${t('hold_tv')}</p></div>`;
      break;
    case 'about':
      answered = new Set();
      app.innerHTML = `<div class="top"><span class="chip pill">${m.rounds > 1 ? `${t('round_of', { n: m.round, total: m.rounds })} · ` : ''}${t('k_about')}</span>${ring(132)}</div>
        <div class="col center"><h1 class="huge">${t('about_tv')}</h1>
          <div class="row"><div class="who" id="who"></div></div><span class="muted big" id="ans"></span></div>`;
      startTimer(m.seconds);
      break;
    case 'question': cur = m; answered = new Set(); question(m); break;
    case 'answered':
      if (cur && isSprint(cur.kind)) progress(m.players);
      setHTML('who', m.players.map(p => avatar(p, 60, !p.done ? 'off' : answered.has(p.name) ? '' : 'pop')).join(''));
      m.players.forEach(p => { if (p.done) answered.add(p.name); });
      setText('ans', t('answered', { n: m.players.filter(p => p.done).length, total: m.players.length }));
      break;
    case 'reveal': if (cur) reveal(cur, m); break;
    case 'round_end': roundEnd(m); break;
    case 'scores': stopTimer(); final(m); break;
    case 'error':
      stopTimer();
      app.innerHTML = `<div class="col center"><h1 class="huge">${t('error')}</h1><p class="muted big">${esc(m.message)}</p>
        <button class="btn big" data-action="setup">${t('back_setup')}</button></div>`;
      break;
  }
}

app.addEventListener('click', e => {
  const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-action]'));
  if (!b) return;
  switch (b.dataset.action) {
    case 'set': {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === 'avatars' || k === 'ai_awards') send({ type: 'settings', settings: { [k]: v === 'true' } });
      else if (k?.startsWith('type') && settings) {
        const types = [...settings.types];
        types[Number(k.slice(4))] = /** @type {Settings['types'][number]} */ (v);
        send({ type: 'settings', settings: { types } });
      }
      else if (k) send({ type: 'settings', settings: { [k]: Number(v) } });
      break;
    }
    case 'open': send({ type: 'open' }); break;
    case 'setup': send({ type: 'setup' }); break;
    case 'start': send({ type: 'start' }); break;
    case 'fullscreen': goFullscreen(); break;
  }
});

loadInfo().then(async i => {
  info = i;
  app.innerHTML = `<h1 class="huge">${t('connecting')}</h1>`;
  if (i.dev && (await import('./dev.js')).devBar('host', on)) return;  // previewing a screen offline
  connect('host', on);
});
