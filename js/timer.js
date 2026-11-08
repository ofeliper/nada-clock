// Abas Timer e Cronômetro.
// A contagem é sempre calculada por horário (início/término), nunca "subtraindo 1 por segundo":
// assim o tempo continua certo mesmo se o app ficar em segundo plano ou for recarregado.
import * as store from "./store.js";
import { t, formatShortTime } from "./i18n.js";
import { play } from "./sound.js";

const KEY = "nada-clock:timers:v1";
const ALARM_MAX_MS = 90 * 1000;     // alarme toca por até 90 s
const ALARM_GAP_MS = 1600;
const MAX_TIMER_MS = (23 * 3600 + 59 * 60 + 59) * 1000;
const PRESETS = [1, 3, 5, 10, 15, 25, 30, 60]; // minutos

const pad = (n) => String(n).padStart(2, "0");

const DEFAULT_STATE = {
  timer: { duration: 5 * 60 * 1000, status: "idle", endAt: 0, remaining: 0, total: 0, doneAt: 0 },
  stopwatch: { status: "idle", startAt: 0, elapsed: 0, laps: [] },
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.timer && raw.stopwatch) {
      return { timer: { ...DEFAULT_STATE.timer, ...raw.timer }, stopwatch: { ...DEFAULT_STATE.stopwatch, ...raw.stopwatch } };
    }
  } catch { /* ignora */ }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ok */ }
  onChange?.();
}

let onChange = null;     // avisa o app (pontinho nas abas)
let onFinish = null;     // timer terminou
let activeTab = "clock";
let raf = 0;
let alarmTimer = 0;
let alarmUntil = 0;

export function init({ changed, finished }) {
  onChange = changed;
  onFinish = finished;
}

export function reset() {
  stopAlarm();
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  save();
  renderTimer();
  renderStopwatch();
}

export const timerActive = () => state.timer.status === "running" || state.timer.status === "paused" || state.timer.status === "done";
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

function timerRemaining(now = Date.now()) {
  const tm = state.timer;
  if (tm.status === "running") return Math.max(0, tm.endAt - now);
  if (tm.status === "paused") return tm.remaining;
  if (tm.status === "done") return 0;
  return tm.duration;
}

function timerStart() {
  const tm = state.timer;
  if (tm.duration <= 0) return;
  tm.status = "running";
  tm.total = tm.duration;
  tm.endAt = Date.now() + tm.duration;
  save();
}

function timerPause() {
  const tm = state.timer;
  tm.remaining = Math.max(0, tm.endAt - Date.now());
  tm.status = "paused";
  save();
}

function timerResume() {
  const tm = state.timer;
  tm.endAt = Date.now() + tm.remaining;
  tm.status = "running";
  save();
}

function timerCancel() {
  stopAlarm();
  state.timer.status = "idle";
  save();
}

function timerAddMinute() {
  const tm = state.timer;
  if (tm.status === "running") tm.endAt += 60000;
  else if (tm.status === "paused") tm.remaining += 60000;
  tm.total += 60000;
  save();
}

function timerFinish(silent = false) {
  const tm = state.timer;
  tm.status = "done";
  tm.doneAt = tm.endAt || Date.now();
  save();
  if (!silent) startAlarm();
  onFinish?.();
}

function adjustDuration(deltaMs) {
  const tm = state.timer;
  tm.duration = Math.min(MAX_TIMER_MS, Math.max(0, tm.duration + deltaMs));
  save();
}

// ===================== Alarme =====================

function startAlarm() {
  stopAlarm();
  alarmUntil = Date.now() + ALARM_MAX_MS;
  const ring = () => {
    if (Date.now() > alarmUntil || state.timer.status !== "done") { stopAlarm(); return; }
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
      </div>
      <div class="tv-run">
        <div class="tv-big" data-big></div>
        <div class="tv-progress"><span data-progress></span></div>
        <div class="tv-sub" data-sub></div>
      </div>
    </div>
    <div class="tv-actions" data-actions></div>`;

  el.addEventListener("click", onTimerClick);
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
  const b = e.target.closest("[data-preset], [data-act]");
  if (!b) return;
  if (b.dataset.preset) { state.timer.duration = Number(b.dataset.preset) * 60000; save(); }
  switch (b.dataset.act) {
    case "start": timerStart(); break;
    case "pause": timerPause(); break;
    case "resume": timerResume(); break;
    case "cancel": timerCancel(); break;
    case "add1": timerAddMinute(); break;
    case "stop": timerCancel(); break;
  }
  renderTimer();
  syncFrame();
}

function btn(act, label, kind = "") {
  return `<button type="button" class="tbtn ${kind}" data-act="${act}">${label}</button>`;
}

export function renderTimer(now = Date.now()) {
  if (!tEl) return;
  const tm = state.timer;
  tEl.dataset.status = tm.status;
  tEl.querySelector("[data-now]").textContent = nowClock();

  if (tm.status === "idle") {
    const total = Math.round(tm.duration / 1000);
    tEl.querySelector('[data-unit="h"]').textContent = pad(Math.floor(total / 3600));
    tEl.querySelector('[data-unit="m"]').textContent = pad(Math.floor((total % 3600) / 60));
    tEl.querySelector('[data-unit="s"]').textContent = pad(total % 60);
    tEl.querySelectorAll("[data-preset]").forEach((c) => c.classList.toggle("on", Number(c.dataset.preset) * 60000 === tm.duration));
    setActions(tEl, `<button type="button" class="tbtn primary" data-act="start" ${tm.duration <= 0 ? "disabled" : ""}>${t("timer.start")}</button>`);
    return;
  }

  const rem = timerRemaining(now);
  const big = tEl.querySelector("[data-big]");
  big.textContent = fmtTimer(rem);
  big.classList.toggle("long", rem >= 3600000);
  const pct = tm.total > 0 ? Math.min(100, Math.max(0, (1 - rem / tm.total) * 100)) : 100;
  tEl.querySelector("[data-progress]").style.width = pct + "%";

  const sub = tEl.querySelector("[data-sub]");
  if (tm.status === "running") sub.textContent = t("timer.endsAt", { time: formatShortTime(new Date(tm.endAt)) });
  else if (tm.status === "paused") sub.textContent = t("timer.paused");
  else sub.textContent = t("timer.done");

  if (tm.status === "running") setActions(tEl, btn("cancel", t("timer.cancel")) + btn("pause", t("timer.pause"), "primary") + btn("add1", t("timer.add1")));
  else if (tm.status === "paused") setActions(tEl, btn("cancel", t("timer.cancel")) + btn("resume", t("timer.resume"), "primary") + btn("add1", t("timer.add1")));
  else setActions(tEl, btn("stop", t("timer.stop"), "primary big"));
}

function setActions(root, html) {
  const box = root.querySelector("[data-actions]");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
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
  const tm = state.timer;
  if (tm.status === "running" && now >= tm.endAt) {
    // se terminou há muito tempo (app fechado), mostra sem tocar o alarme
    timerFinish(now - tm.endAt > ALARM_MAX_MS);
  }
  if (activeTab === "timer") renderTimer(now);
  if (activeTab === "stopwatch" && !raf) renderStopwatch(now);
}

function frame() {
  const now = Date.now();
  if (activeTab === "stopwatch") renderStopwatch(now);
  else if (activeTab === "timer") renderTimer(now);
  raf = requestAnimationFrame(frame);
}

/** Animação contínua só quando precisa (cronômetro rodando, timer rodando na tela). */
function syncFrame() {
  const need = (activeTab === "stopwatch" && state.stopwatch.status === "running")
    || (activeTab === "timer" && state.timer.status === "running");
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
