// Aba Pomodoro: foco → pausa curta → foco → … → pausa longa (a cada N focos).
// Como o Timer, conta pelo horário de término, então continua certo em segundo plano.
import * as store from "./store.js";
import { t, formatShortTime } from "./i18n.js";
import { play } from "./sound.js";

const KEY = "nada-clock:pomodoro:v1";
const pad = (n) => String(n).padStart(2, "0");

const DEFAULT_STATE = { phase: "focus", status: "idle", endAt: 0, remaining: 0, total: 0, done: 0 };
// done = focos concluídos no ciclo atual (0 … cycles-1)

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.phase) return { ...DEFAULT_STATE, ...raw };
  } catch { /* ok */ }
  return { ...DEFAULT_STATE };
}

let st = load();
let el = null;
let active = false;
let raf = 0;
let onChange = null;
let onFinish = null;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ok */ }
  onChange?.();
}

export function init({ changed, finished }) {
  onChange = changed;
  onFinish = finished;
}

export const isActive = () => st.status === "running" || st.status === "paused";

const phaseMs = (phase) => {
  const p = store.get().pomo;
  return (phase === "focus" ? p.focus : phase === "short" ? p.short : p.long) * 60000;
};

function remaining(now = Date.now()) {
  if (st.status === "running") return Math.max(0, st.endAt - now);
  if (st.status === "paused") return st.remaining;
  return phaseMs(st.phase);
}

function start() {
  st.total = phaseMs(st.phase);
  st.endAt = Date.now() + st.total;
  st.status = "running";
  save();
}

function pause() { st.remaining = Math.max(0, st.endAt - Date.now()); st.status = "paused"; save(); }
function resume() { st.endAt = Date.now() + st.remaining; st.status = "running"; save(); }

/** Vai para a próxima fase. natural = terminou sozinha (toca som / pode começar sozinha). */
function advance(natural) {
  const cycles = store.get().pomo.cycles;
  if (st.phase === "focus") {
    const done = st.done + 1;
    if (done >= cycles) { st.phase = "long"; st.done = cycles; }
    else { st.phase = "short"; st.done = done; }
  } else {
    if (st.phase === "long") st.done = 0;
    st.phase = "focus";
  }
  st.status = "idle";
  if (natural) {
    const so = store.get().sounds;
    for (let i = 0; i < 3; i++) play(so.timerSound || "chime", Math.max(so.volume, 0.4), i * 1.2);
    try { navigator.vibrate?.([250, 120, 250]); } catch { /* ok */ }
    onFinish?.();
  }
  if (natural && store.get().pomo.autoStart) start();
  else save();
}

function resetAll() {
  st = { ...DEFAULT_STATE };
  save();
}

export function reset() {
  resetAll();
  render();
}

// ---------------- Vista ----------------

export function mount(target) {
  el = target;
  el.innerHTML = `
    <div class="tv-clock" data-now></div>
    <div class="tv-body">
      <div class="pomo-phase" data-phase></div>
      <div class="tv-run">
        <div class="tv-big" data-big></div>
        <div class="tv-progress"><span data-progress></span></div>
        <div class="tv-sub" data-sub></div>
      </div>
      <div class="pomo-dots" data-dots></div>
    </div>
    <div class="tv-actions" data-actions></div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    switch (b.dataset.act) {
      case "start": start(); break;
      case "pause": pause(); break;
      case "resume": resume(); break;
      case "skip": advance(false); break;
      case "reset": resetAll(); break;
    }
    render();
    syncFrame();
  });
  render();
}

export function relabel() {
  if (!el) return;
  const fresh = el.cloneNode(false);
  el.replaceWith(fresh);
  mount(fresh);
}

const btn = (act, label, kind = "") => `<button type="button" class="tbtn ${kind}" data-act="${act}">${label}</button>`;

export function render(now = Date.now()) {
  if (!el) return;
  const p = store.get().pomo;
  el.dataset.status = st.status;
  el.dataset.phase = st.phase;
  const d = new Date();
  el.querySelector("[data-now]").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  el.querySelector("[data-phase]").textContent = t("pomo." + st.phase);

  const rem = remaining(now);
  const total = Math.max(0, Math.ceil(rem / 1000));
  el.querySelector("[data-big]").textContent = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  const tot = st.status === "idle" ? phaseMs(st.phase) : st.total;
  el.querySelector("[data-progress]").style.width = (tot ? Math.min(100, (1 - rem / tot) * 100) : 0) + "%";

  const sub = el.querySelector("[data-sub]");
  if (st.status === "running") sub.textContent = t("timer.endsAt", { time: formatShortTime(new Date(st.endAt)) });
  else if (st.status === "paused") sub.textContent = t("timer.paused");
  else sub.textContent = t("pomo.ready");

  const filled = st.phase === "long" ? p.cycles : st.done;
  const dots = Array.from({ length: p.cycles }, (_, i) => `<i class="${i < filled ? "on" : ""}${i === filled && st.phase === "focus" ? " cur" : ""}"></i>`).join("");
  const dotsEl = el.querySelector("[data-dots]");
  if (dotsEl.innerHTML !== dots) dotsEl.innerHTML = dots;

  let html;
  if (st.status === "idle") html = btn("reset", t("pomo.reset")) + btn("start", t(st.phase === "focus" ? "pomo.startFocus" : "pomo.startBreak"), "primary") + btn("skip", t("pomo.skip"));
  else if (st.status === "running") html = btn("reset", t("pomo.reset")) + btn("pause", t("timer.pause"), "primary") + btn("skip", t("pomo.skip"));
  else html = btn("reset", t("pomo.reset")) + btn("resume", t("timer.resume"), "primary") + btn("skip", t("pomo.skip"));
  const box = el.querySelector("[data-actions]");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}

// ---------------- Laço ----------------

export function tick(now = Date.now()) {
  if (st.status === "running" && now >= st.endAt) advance(now - st.endAt < 90000);
  if (active && !raf) render(now);
}

function frame() {
  render();
  raf = requestAnimationFrame(frame);
}

function syncFrame() {
  const need = active && st.status === "running";
  if (need && !raf) raf = requestAnimationFrame(frame);
  if (!need && raf) { cancelAnimationFrame(raf); raf = 0; }
}

export function setActive(on) {
  active = on;
  if (on) render();
  syncFrame();
}
