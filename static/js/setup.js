// @ts-check
// Game settings form, shared by the TV's setup screen (host.js) and the phone remote (remote.js)
import { t, send, isSprint } from './common.js';

/** @typedef {import('./types').Settings} Settings */
/** @typedef {import('./types').SetupMsg} SetupMsg */
/** @typedef {keyof import('./types').SettingOptions} OptionKey */

/** The setup message the form was last drawn from @type {SetupMsg | null} */
let last = null;
/** Whether the Advanced section is open (per screen, kept while the form is redrawn) */
let advanced = false;

/** @param {number} v */
const secs = v => v >= 60 && v % 60 === 0 ? t('mins', { n: v / 60 }) : t('secs', { n: v });
/** @param {number} e % of easy questions */
const easyHard = e => t('easy_hard', { e, h: 100 - e });

/** Number of questions and a rough duration in minutes. @param {Settings} st */
export function estimate(st) {
  const types = st.types.slice(0, st.rounds);
  /** Reading + answer time + reveal per question; a sprint is one 60 s set @param {string} k */
  const play = k => isSprint(k) ? 75 : st.per_round * (st.read_seconds + (k === 'truefalse' ? Math.max(5, st.question_seconds / 2) : k === 'draw' ? Math.max(60, st.question_seconds) : st.question_seconds) + st.reveal_seconds + 4);
  // Rough upper bound: suggestions + tidying once, vote + generation per round (picking power-ups mostly overlaps it),
  // playing the round, standings between rounds
  const minutes = Math.ceil((st.suggest_seconds + 10 + st.rounds * (st.category_seconds + 20 + (st.powerups ? 10 : 0)) + types.reduce((a, k) => a + play(k), 0) + (st.rounds - 1) * 8) / 60);
  return { total: st.rounds * st.per_round, minutes };
}

/** The settings rows. Wire them up once with wireSettings(). @param {SetupMsg} m */
export function settingsRows(m) {
  last = m;
  const st = m.settings, o = m.options;
  /** @param {string} key @param {string} label @param {{ v: string, label: string, on: boolean }[]} choices */
  const row = (key, label, choices) => `<div class="srow"><span class="slabel">${label}</span><div class="row">${choices.map(c =>
    `<button class="count${c.on ? ' on' : ''}" data-action="set" data-k="${key}" data-v="${c.v}" aria-pressed="${c.on}">${c.label}</button>`).join('')}</div></div>`;
  /** A table row of label and dropdown, for long lists @param {string} key @param {string} label @param {{ v: string, label: string, on: boolean }[]} choices */
  const pick = (key, label, choices) => `<label class="trow"><span class="slabel">${label}</span><select class="spick" data-k="${key}">${choices.map(c =>
    `<option value="${c.v}"${c.on ? ' selected' : ''}>${c.label}</option>`).join('')}</select></label>`;
  /** A slider over a setting's options, with its value as text (easy share only for now) @param {OptionKey} key @param {string} label */
  const slide = (key, label) => `<label class="srow"><span class="slabel">${label}</span><div class="row slide">
    <input type="range" class="spick-range" data-k="${key}" min="0" max="${o[key].length - 1}" value="${o[key].indexOf(st[key])}">
    <b class="sval">${easyHard(st[key])}</b></div></label>`;
  /** @param {OptionKey} key @param {(v: number) => string} fmt */
  const nums = (key, fmt) => o[key].map(v => ({ v: String(v), label: fmt(v), on: v === st[key] }));
  /** @param {'avatars' | 'adult' | 'powerups'} key @param {string} label */
  const onOff = (key, label) => row(key, label, [{ v: 'true', label: t('on'), on: st[key] }, { v: 'false', label: t('off'), on: !st[key] }]);
  return `${row('rounds', t('s_rounds'), nums('rounds', String))}
    ${row('per_round', t('s_per_round'), nums('per_round', String))}
    <div class="tgrid">${st.types.slice(0, st.rounds).map((k, r) => pick(`type${r}`, t('s_type', { n: r + 1 }), m.types.map(v => ({ v, label: t('k_' + v), on: v === k })))).join('')}</div>
    ${slide('easy_share', t('s_easy'))}
    ${row('suggest_seconds', t('s_suggest_time'), nums('suggest_seconds', secs))}
    ${row('category_seconds', t('s_cat_time'), nums('category_seconds', secs))}
    ${row('question_seconds', t('s_q_time'), nums('question_seconds', secs))}
    ${row('read_seconds', t('s_read_time'), nums('read_seconds', secs))}
    ${row('reveal_seconds', t('s_reveal_time'), nums('reveal_seconds', secs))}
    ${onOff('avatars', t('s_avatars'))}
    ${onOff('powerups', t('s_powerups'))}
    ${onOff('adult', t('s_adult'))}
    <button class="adv" data-action="advanced" aria-expanded="${advanced}">${t('s_advanced')}<svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg></button>
    <div class="advanced"${advanced ? '' : ' hidden'}>
      ${row('speed_window', t('s_speed_window'), nums('speed_window', secs))}
    </div>`;
}

/** @param {string | undefined} k @param {string | undefined} v */
function setSetting(k, v) {
  if (k === 'avatars' || k === 'adult' || k === 'powerups') send({ type: 'settings', settings: { [k]: v === 'true' } });
  else if (k?.startsWith('type') && last) {
    const types = [...last.settings.types];
    types[Number(k.slice(4))] = /** @type {Settings['types'][number]} */ (v);
    send({ type: 'settings', settings: { types } });
  }
  else if (k) send({ type: 'settings', settings: { [k]: Number(v) } });
}

/** Option value at a slider's position @param {HTMLInputElement} s */
const slid = s => last?.options[/** @type {OptionKey} */ (s.dataset.k)]?.[Number(s.value)];

/** Send changes made in the settings rows drawn inside `root`. @param {HTMLElement} root */
export function wireSettings(root) {
  root.addEventListener('click', e => {
    const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('[data-action="set"]'));
    if (b) setSetting(b.dataset.k, b.dataset.v);
    const adv = /** @type {Element} */ (e.target).closest('[data-action="advanced"]');
    if (adv) {
      advanced = !advanced;
      adv.setAttribute('aria-expanded', String(advanced));
      root.querySelector('.advanced')?.toggleAttribute('hidden', !advanced);
    }
  });
  root.addEventListener('change', e => {
    const s = /** @type {HTMLSelectElement | HTMLInputElement} */ (e.target);
    if (s.matches('.spick')) setSetting(s.dataset.k, s.value);
    if (s.matches('.spick-range')) setSetting(s.dataset.k, String(slid(/** @type {HTMLInputElement} */ (s))));
  });
  // While dragging, update the shown value; the setting is sent on release
  root.addEventListener('input', e => {
    const s = /** @type {HTMLInputElement} */ (e.target), out = s.closest('.slide')?.querySelector('.sval');
    const v = s.matches('.spick-range') ? slid(s) : undefined;
    if (out && v !== undefined) out.textContent = easyHard(v);
  });
}
