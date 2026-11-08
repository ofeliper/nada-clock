// Abas Timer (vários timers ao mesmo tempo, com nome) e Cronômetro.
// A contagem é sempre calculada por horário (início/término), nunca "subtraindo 1 por segundo":
// assim o tempo continua certo mesmo se o app ficar em segundo plano ou for recarregado.
import * as store from "./store.js";
import { t, formatShortTime } from "./i18n.js";
import { play } from "./sound.js";

const KEY = "nada-clock:timers:v1";
const ALARM_MAX_MS = 90 * 1000;     // alarme toca por até 90 s
const ALARM_GAP_MS = 1600;
const MAX_TIMER_MS = (23 * 3600 + 59 * 60 + 59) * 1000;
const MAX_TIMERS = 10;
const PRESETS = [1, 3, 5, 10, 15, 25, 30, 60]; // minutos

const pad = (n) => String(n).padStart(2, "0");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const DEFAULT_STATE = {
  draft: { duration: 5 * 60 * 1000, name: "" },
  timers: [],   // { id, name, status: running|paused|done, endAt, remaining, total, doneAt, silent }
  stopwatch: { status: "idle", startAt: 0, elapsed: 0, laps: [] },
};

function load() {
  const fresh = JSON.parse(JSON.stringify(DEFAULT_STATE));
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return fresh;
    const out = { ...fresh, stopwatch: { ...fresh.stopwatch, ...(raw.stopwatch || {}) } };
    if (Array.isArray(raw.timers)) {
      out.timers = raw.timers;
      out.draft = { ...fresh.draft, ...(raw.draft || {}) };
    } else if (raw.timer) {
      // v0.5 → v0.6: um único timer vira o primeiro da lista
      out.draft.duration = raw.timer.duration || fresh.draft.duration;
      if (["running", "paused", "done"].includes(raw.timer.status)) {
        out.timers = [{ id: uid(), name: "", status: raw.timer.status, endAt: raw.timer.endAt, remaining: raw.timer.remaining, total: raw.timer.total, doneAt: raw.timer.doneAt }];
      }
    }
    return out;
  } catch {
    return fresh;
  }
}

let state = load();
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ok */ }   // grava já no formato novo
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ok */ }
  onChange?.();
}

let onChange = null;     // avisa o app (pontinho nas abas)
let onFinish = null;     // um timer terminou
let activeTab = "clock";
let raf = 0;
let alarmTimer = 0;
let alarmUntil = 0;
let adding = false;      // mostrando o editor com timers já rodando
let focusId = null;      // timer em destaque

export function init({ changed, finished }) {
  onChange = changed;
  onFinish = finished;
}

export function reset() {
  stopAlarm();
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  adding = false;
  focusId = null;
  save();
  renderTimer();
  renderStopwatch();
}

export const timerActive = () => state.timers.length > 0;
export const stopwatchActive = () => state.stopwatch.status === "running" || state.stopwatch.status === "paused";

// ===================== Formatação =====================

function fmtTimer(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtStopwatch(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const main = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { main, cs: pad(cs) };
}

const nowClock = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ===================== Timer: lógica =====================

const find = (id) => state.timers.find((x) => x.id === id);

function timerRemaining(tm, now = Date.now()) {
  if (tm.status === "running") return Math.max(0, tm.endAt - now);
  if (tm.status === "paused") return tm.remaining;
  return 0;
}

function startNew() {
  const d = state.draft;
  if (d.duration <= 0 || state.timers.length >= MAX_TIMERS) return;
  const tm = { id: uid(), name: String(d.name || "").trim().slice(0, 30), status: "running", total: d.duration, endAt: Date.now() + d.duration, remaining: 0, doneAt: 0 };
  state.timers.push(tm);
  state.draft.name = "";
  focusId = tm.id;
  adding = false;
  save();
}

function pauseT(tm) { tm.remaining = Math.max(0, tm.endAt - Date.now()); tm.status = "paused"; save(); }
function resumeT(tm) { tm.endAt = Date.now() + tm.remaining; tm.status = "running"; save(); }
function addMinute(tm) {
  if (tm.status === "running") tm.endAt += 60000;
  else if (tm.status === "paused") tm.remaining += 60000;
  tm.total += 60000;
  save();
}
function removeT(tm) {
  state.timers = state.timers.filter((x) => x !== tm);
  if (focusId === tm.id) focusId = null;
  if (!state.timers.some((x) => x.status === "done" && !x.silent)) stopAlarm();
  save();
}

function finishT(tm, silent) {
  tm.status = "done";
  tm.doneAt = tm.endAt || Date.now();
  tm.silent = silent;
  focusId = tm.id;
  save();
  if (!silent) startAlarm();
  onFinish?.();
}

function adjustDuration(deltaMs) {
  const d = state.draft;
  d.duration = Math.min(MAX_TIMER_MS, Math.max(0, d.duration + deltaMs));
  save();
}

/** Timer em destaque: o que terminou, o escolhido, ou o que termina primeiro. */
function focused(now = Date.now()) {
  const done = state.timers.find((x) => x.status === "done");
  if (done) return done;
  const sel = focusId && find(focusId);
  if (sel) return sel;
  // rodando antes de pausados; entre eles, o que termina primeiro
  const rank = (x) => (x.status === "running" ? 0 : 1);
  return [...state.timers].sort((a, b) => rank(a) - rank(b) || timerRemaining(a, now) - timerRemaining(b, now))[0] || null;
}

// ===================== Alarme =====================

function startAlarm() {
  stopAlarm();
  alarmUntil = Date.now() + ALARM_MAX_MS;
  const ring = () => {
    const ringing = state.timers.some((x) => x.status === "done" && !x.silent);
    if (Date.now() > alarmUntil || !ringing) { stopAlarm(); return; }
    const so = store.get().sounds;
    play(so.timerSound || "chime", Math.max(so.volume, 0.4));
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* ok */ }
  };
  ring();
  alarmTimer = setInterval(ring, ALARM_GAP_MS);
}

function stopAlarm() {
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = 0;
}

// ===================== Cronômetro: lógica =====================

function swElapsed(now = Date.now()) {
  const sw = state.stopwatch;
  return sw.status === "running" ? sw.elapsed + (now - sw.startAt) : sw.elapsed;
}

function swStart() {
  const sw = state.stopwatch;
  sw.startAt = Date.now();
  sw.status = "running";
  save();
}

function swPause() {
  const sw = state.stopwatch;
  sw.elapsed = swElapsed();
  sw.status = "paused";
  save();
}

function swLap() {
  state.stopwatch.laps.unshift(swElapsed());
  state.stopwatch.laps = state.stopwatch.laps.slice(0, 99);
  save();
}

function swReset() {
  state.stopwatch = { status: "idle", startAt: 0, elapsed: 0, laps: [] };
  save();
}

// ===================== Vistas =====================

let tEl, sEl;

const ICON_UP = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

function stepper(unit, ms) {
  return `
    <div class="tv-unit">
      <button type="button" class="tv-step" data-step="${ms}" aria-label="${t("timer.up")} ${t("timer." + unit)}">${ICON_UP}</button>
      <span class="tv-digits" data-unit="${unit}">00</span>
      <button type="button" class="tv-step" data-step="${-ms}" aria-label="${t("timer.down")} ${t("timer." + unit)}">${ICON_DOWN}</button>
      <span class="tv-unit-label">${t("timer." + unit)}</span>
    </div>`;
}

export function mountTimer(el) {
  tEl = el;
  rows.clear();
  el.innerHTML = `
    <div class="tv-clock" data-now></div>
    <div class="tv-body">
      <div class="tv-edit">
        <div class="tv-steppers">
          ${stepper("h", 3600000)}<span class="tv-colon">:</span>${stepper("m", 60000)}<span class="tv-colon">:</span>${stepper("s", 10000)}
        </div>
        <div class="tv-presets">
          ${PRESETS.map((m) => `<button type="button" class="tv-chip" data-preset="${m}">${m >= 60 ? m / 60 + "h" : m + "m"}</button>`).join("")}
        </div>
        <input type="text" class="tv-name" data-name maxlength="30" placeholder="${t("timer.namePlaceholder")}" aria-label="${t("timer.name")}" autocomplete="off" enterkeyhint="done">
      </div>
      <div class="tv-run">
        <div class="tv-label" data-label></div>
        <div class="tv-big" data-big role="timer"></div>
        <div class="tv-progress"><span data-progress></span></div>
        <div class="tv-sub" data-sub aria-live="polite"></div>
      </div>
      <ul class="tm-list" data-list></ul>
    </div>
    <div class="tv-actions" data-actions></div>`;

  el.addEventListener("click", onTimerClick);
  el.addEventListener("input", (e) => {
    if (e.target.matches("[data-name]")) { state.draft.name = e.target.value; save(); }
  });
  el.addEventListener("keydown", (e) => {
    if (e.target.matches("[data-name]") && e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  });
  bindHold(el);
  renderTimer();
}

/** Segurar o botão ▲/▼ repete o ajuste. */
function bindHold(el) {
  let holdT = 0, repT = 0, fired = false;
  const stop = () => { clearTimeout(holdT); clearInterval(repT); holdT = repT = 0; };
  el.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    fired = false;
    const step = Number(b.dataset.step);
    holdT = setTimeout(() => {
      fired = true;
      repT = setInterval(() => { adjustDuration(step); renderTimer(); }, 110);
    }, 420);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, stop));
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    if (!fired) { adjustDuration(Number(b.dataset.step)); renderTimer(); }
    fired = false;
  });
}

function onTimerClick(e) {
  const b = e.target.closest("[data-preset], [data-act], [data-row]");
  if (!b) return;
  if (b.dataset.preset) { state.draft.duration = Number(b.dataset.preset) * 60000; save(); }
  const id = b.dataset.id || b.closest("[data-row]")?.dataset.row;
  const tm = id ? find(id) : focused();
  switch (b.dataset.act) {
    case "start": startNew(); break;
    case "add": adding = true; break;
    case "back": adding = false; break;
    case "pause": if (tm) pauseT(tm); break;
    case "resume": if (tm) resumeT(tm); break;
    case "add1": if (tm) addMinute(tm); break;
    case "cancel": case "stop": if (tm) removeT(tm); break;
    default:
      if (b.dataset.row) focusId = b.dataset.row;
  }
  renderTimer();
  syncFrame();
}

function btn(act, label, kind = "", extra = "") {
  return `<button type="button" class="tbtn ${kind}" data-act="${act}" ${extra}>${label}</button>`;
}

function setActions(root, html) {
  const box = root.querySelector("[data-actions]");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}

// linhas da lista, reaproveitadas (para não recriar botões a cada segundo)
const rows = new Map();

function renderList(others, now) {
  const list = tEl.querySelector("[data-list]");
  const ids = new Set(others.map((x) => x.id));
  for (const [id, li] of rows) if (!ids.has(id)) { li.remove(); rows.delete(id); }
  others.forEach((tm, i) => {
    let li = rows.get(tm.id);
    if (!li) {
      li = document.createElement("li");
      li.dataset.row = tm.id;
      li.innerHTML = `<span class="tm-name"></span><span class="tm-time"></span>
        <button type="button" class="tm-btn" data-act="" data-id="${tm.id}"></button>
        <button type="button" class="tm-btn" data-act="cancel" data-id="${tm.id}" aria-label="${t("timer.cancel")}">${ICON_X}</button>`;
      rows.set(tm.id, li);
    }
    if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
    li.dataset.status = tm.status;
    li.querySelector(".tm-name").textContent = tm.name || t("timer.unnamed");
    li.querySelector(".tm-time").textContent = tm.status === "done" ? t("timer.doneShort") : fmtTimer(timerRemaining(tm, now));
    const pb = li.querySelector(".tm-btn");
    const act = tm.status === "running" ? "pause" : tm.status === "paused" ? "resume" : "stop";
    if (pb.dataset.act !== act) {
      pb.dataset.act = act;
      pb.innerHTML = act === "pause" ? ICON_PAUSE : act === "resume" ? ICON_PLAY : ICON_X;
      pb.setAttribute("aria-label", t(act === "pause" ? "timer.pause" : act === "resume" ? "timer.resume" : "timer.stop"));
      pb.hidden = act === "stop";
    }
  });
}

export function renderTimer(now = Date.now()) {
  if (!tEl) return;
  const editing = adding || state.timers.length === 0;
  tEl.dataset.status = editing ? "idle" : "list";
  tEl.querySelector("[data-now]").textContent = nowClock();

  if (editing) {
    const total = Math.round(state.draft.duration / 1000);
    tEl.querySelector('[data-unit="h"]').textContent = pad(Math.floor(total / 3600));
    tEl.querySelector('[data-unit="m"]').textContent = pad(Math.floor((total % 3600) / 60));
    tEl.querySelector('[data-unit="s"]').textContent = pad(total % 60);
    tEl.querySelectorAll("[data-preset]").forEach((c) => c.classList.toggle("on", Number(c.dataset.preset) * 60000 === state.draft.duration));
    const name = tEl.querySelector("[data-name]");
    if (document.activeElement !== name && name.value !== state.draft.name) name.value = state.draft.name;
    const full = state.timers.length >= MAX_TIMERS;
    setActions(tEl, (state.timers.length ? btn("back", t("timer.back")) : "")
      + btn("start", t("timer.start"), "primary", state.draft.duration <= 0 || full ? "disabled" : ""));
    tEl.removeAttribute("data-has-list");
    renderList([], now);
    return;
  }

  const tm = focused(now);
  const rem = timerRemaining(tm, now);
  tEl.dataset.status = tm.status;
  tEl.querySelector("[data-label]").textContent = tm.name || (state.timers.length > 1 ? t("timer.unnamed") : "");
  const big = tEl.querySelector("[data-big]");
  big.textContent = fmtTimer(rem);
  big.classList.toggle("long", rem >= 3600000);
  const pct = tm.total > 0 ? Math.min(100, Math.max(0, (1 - rem / tm.total) * 100)) : 100;
  tEl.querySelector("[data-progress]").style.width = pct + "%";

  const sub = tEl.querySelector("[data-sub]");
  if (tm.status === "running") sub.textContent = t("timer.endsAt", { time: formatShortTime(new Date(tm.endAt)) });
  else if (tm.status === "paused") sub.textContent = t("timer.paused");
  else sub.textContent = t("timer.done");

  const canAdd = state.timers.length < MAX_TIMERS;
  const plus = canAdd ? btn("add", "+ " + t("timer.new"), "ghost") : "";
  if (tm.status === "running") setActions(tEl, btn("cancel", t("timer.cancel"), "", `data-id="${tm.id}"`) + btn("pause", t("timer.pause"), "primary", `data-id="${tm.id}"`) + btn("add1", t("timer.add1"), "", `data-id="${tm.id}"`) + plus);
  else if (tm.status === "paused") setActions(tEl, btn("cancel", t("timer.cancel"), "", `data-id="${tm.id}"`) + btn("resume", t("timer.resume"), "primary", `data-id="${tm.id}"`) + btn("add1", t("timer.add1"), "", `data-id="${tm.id}"`) + plus);
  else setActions(tEl, btn("stop", t("timer.stop"), "primary big", `data-id="${tm.id}"`));

  const others = state.timers.filter((x) => x !== tm);
  tEl.toggleAttribute("data-has-list", others.length > 0);
  renderList(others, now);
}

export function mountStopwatch(el) {
  sEl = el;
  el.innerHTML = `
    <div class="tv-clock" data-now></div>
    <div class="tv-body">
      <div class="tv-run">
        <div class="tv-big sw" data-big><span data-main>00:00</span><span class="cs" data-cs>.00</span></div>
      </div>
      <ol class="sw-laps" data-laps></ol>
    </div>
    <div class="tv-actions" data-actions></div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    switch (b.dataset.act) {
      case "start": swStart(); break;
      case "pause": swPause(); break;
      case "resume": swStart(); break;
      case "lap": swLap(); break;
      case "reset": swReset(); break;
    }
    renderStopwatch();
    syncFrame();
  });
  renderStopwatch();
}

let lastLapsKey = "";
export function renderStopwatch(now = Date.now()) {
  if (!sEl) return;
  const sw = state.stopwatch;
  sEl.dataset.status = sw.status;
  sEl.querySelector("[data-now]").textContent = nowClock();
  const ms = swElapsed(now);
  const f = fmtStopwatch(ms);
  sEl.querySelector("[data-main]").textContent = f.main;
  sEl.querySelector("[data-cs]").textContent = "." + f.cs;
  sEl.querySelector("[data-big]").classList.toggle("long", ms >= 3600000);

  const lapsKey = sw.laps.join(",") + "|" + sw.status;
  if (lapsKey !== lastLapsKey) {
    lastLapsKey = lapsKey;
    const n = sw.laps.length;
    sEl.querySelector("[data-laps]").innerHTML = sw.laps.map((total, i) => {
      const prev = sw.laps[i + 1] || 0;
      const lap = fmtStopwatch(total - prev);
      const tot = fmtStopwatch(total);
      return `<li><span>${t("sw.lapN", { n: n - i })}</span><b>${lap.main}.${lap.cs}</b><span class="tot">${tot.main}.${tot.cs}</span></li>`;
    }).join("");
  }

  if (sw.status === "idle") setActions(sEl, btn("start", t("sw.start"), "primary big"));
  else if (sw.status === "running") setActions(sEl, btn("lap", t("sw.lap")) + btn("pause", t("sw.pause"), "primary"));
  else setActions(sEl, btn("reset", t("sw.reset")) + btn("resume", t("sw.resume"), "primary"));
}

/** Remonta as vistas com os textos do idioma atual. */
export function relabel() {
  if (tEl) { const fresh = tEl.cloneNode(false); tEl.replaceWith(fresh); mountTimer(fresh); }
  if (sEl) { const fresh = sEl.cloneNode(false); sEl.replaceWith(fresh); lastLapsKey = ""; mountStopwatch(fresh); }
}

// ===================== Laço =====================

/** Chamado a cada segundo pelo app, em qualquer aba. */
export function tick(now = Date.now()) {
  for (const tm of state.timers) {
    // se terminou há muito tempo (app fechado), mostra sem tocar o alarme
    if (tm.status === "running" && now >= tm.endAt) finishT(tm, now - tm.endAt > ALARM_MAX_MS);
  }
  if (activeTab === "timer" && !raf) renderTimer(now);
  if (activeTab === "stopwatch" && !raf) renderStopwatch(now);
}

function frame() {
  const now = Date.now();
  if (activeTab === "stopwatch") renderStopwatch(now);
  else if (activeTab === "timer") renderTimer(now);
  raf = requestAnimationFrame(frame);
}

/** Animação contínua só quando precisa (cronômetro rodando, algum timer rodando na tela). */
function syncFrame() {
  const need = (activeTab === "stopwatch" && state.stopwatch.status === "running")
    || (activeTab === "timer" && state.timers.some((x) => x.status === "running"));
  if (need && !raf) raf = requestAnimationFrame(frame);
  if (!need && raf) { cancelAnimationFrame(raf); raf = 0; }
}

export function setActiveTab(tab) {
  activeTab = tab;
  if (tab === "timer") renderTimer();
  if (tab === "stopwatch") renderStopwatch();
  syncFrame();
}

export function stopAlarmIfRinging() {
  if (alarmTimer) stopAlarm();
}
