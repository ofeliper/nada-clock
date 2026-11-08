// NADA Clock — No Ads, Display Always
import * as store from "./store.js";
import * as weather from "./weather.js";
import { resolveLanguage, setLanguage, translateStatic } from "./i18n.js";
import { mountFace, updateFace, relayout } from "./faces.js";
import * as settings from "./settings.js";
import { THEMES, resolveTheme, onSystemChange } from "./themes.js";
import * as sound from "./sound.js";
import * as timers from "./timer.js";
import * as pomodoro from "./pomodoro.js";
import * as location from "./location.js";
import * as update from "./update.js";
import { initPicker } from "./picker.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const grid = $("grid");
const rootStyle = document.documentElement.style;

const MIN_BRIGHTNESS = 0.05;
const UI_HIDE_MS = 3500;
const BURN_IN_MS = 60 * 1000;
const BURN_IN_MAX_PX = 6;

// ---------------- Idioma ----------------
function applyLanguage() {
  setLanguage(resolveLanguage(store.get().language));
  translateStatic();
}

// ---------------- Tema / modo noturno ----------------
function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isNightTime(now, start, end) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === b) return false;
  return a < b ? cur >= a && cur < b : cur >= a || cur < b; // intervalo que cruza a meia-noite
}

const COLOR_VARS = { bg: "--bg", fg: "--fg", hours: "--c-hours", minutes: "--c-minutes", seconds: "--c-seconds" };
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(now = new Date()) {
  const s = store.get();
  const night = s.nightEnabled && isNightTime(now, s.nightStart, s.nightEnd);
  const theme = night ? "night" : resolveTheme(s.theme);
  const html = document.documentElement;
  if (html.dataset.theme !== theme) html.dataset.theme = theme;

  // cores personalizadas do Customizado (o modo noturno tem prioridade)
  const col = s.custom.colors;
  const useCustom = s.face === "custom" && col.enabled && !night;
  for (const [k, cssVar] of Object.entries(COLOR_VARS)) {
    if (useCustom) rootStyle.setProperty(cssVar, col[k]);
    else rootStyle.removeProperty(cssVar);
  }
  if (useCustom) rootStyle.setProperty("--c-sep", col.fg);
  else rootStyle.removeProperty("--c-sep");

  const bg = useCustom ? col.bg : THEMES[theme].bg;
  if (themeMeta) themeMeta.setAttribute("content", bg);
  html.style.colorScheme = isLight(bg) ? "light" : "dark";

  // aparência do menu: automático = acompanha o fundo do relógio
  const ui = s.uiTheme === "light" || s.uiTheme === "dark" ? s.uiTheme : (isLight(bg) ? "light" : "dark");
  if (html.dataset.ui !== ui) html.dataset.ui = ui;
}

function nightActive(now = new Date()) {
  const s = store.get();
  return s.nightEnabled && isNightTime(now, s.nightStart, s.nightEnd);
}

function isLight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

onSystemChange(() => applyTheme());

// ---------------- Brilho ----------------
function applyBrightness(v) {
  rootStyle.setProperty("--brightness", String(v));
}

let indicatorTimer;
function showBrightnessIndicator(v) {
  const pct = Math.round(v * 100);
  $("brightness-fill").style.width = pct + "%";
  $("brightness-value").textContent = pct + "%";
  const ind = $("brightness-indicator");
  ind.classList.add("visible");
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => ind.classList.remove("visible"), 900);
}

// ---------------- Tela sempre ligada (Wake Lock) ----------------
let wakeLock = null;
let wakeLockState = "wakeLock" in navigator ? "off" : "unsupported";

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLockState = "on";
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      wakeLockState = "off";
      settings.refresh();
    });
  } catch {
    wakeLockState = "off"; // ex.: exige um toque do usuário antes; tentamos de novo no próximo toque
  }
  settings.refresh();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestWakeLock();
    tick();
    weather.tick();
  }
});

// ---------------- Controles (mostrar/esconder) ----------------
let uiTimer;
function showUI() {
  document.body.classList.add("ui-visible");
  clearTimeout(uiTimer);
  uiTimer = setTimeout(hideUI, UI_HIDE_MS);
}
function hideUI() {
  document.body.classList.remove("ui-visible");
}
function toggleUI() {
  document.body.classList.contains("ui-visible") ? hideUI() : showUI();
}

$("settings-button").addEventListener("click", () => {
  hideUI();
  settings.open();
});

// ---------------- Rotação forçada ----------------
// Com a rotação do aparelho travada, o app inteiro é girado 90° via CSS.
let rotation = "none";   // none | cw | ccw

const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let rotating = false;

function targetRotation() {
  const s = store.get();
  const forced = s.orientation === "landscape";
  // só gira se a janela estiver em pé; se o aparelho já está deitado, não precisa
  return forced && window.innerHeight > window.innerWidth ? (s.rotateDir === "right" ? "ccw" : "cw") : "none";
}

function setRotationClasses(next) {
  rotation = next;
  const html = document.documentElement;
  html.classList.toggle("rot-cw", rotation === "cw");
  html.classList.toggle("rot-ccw", rotation === "ccw");
}

/**
 * Aplica a orientação. Com animate = true, usa a transição "girar e esmaecer":
 * o conteúdo encolhe e some girando um pouco no sentido do giro, e volta já na nova orientação.
 */
function setFrameVars() {
  // tamanho do "quadro" do app (já considerando o giro forçado)
  const w = window.innerWidth, h = window.innerHeight;
  const rotated = rotation !== "none";
  const fw = rotated ? h : w, fh = rotated ? w : h;
  rootStyle.setProperty("--frame-w", fw + "px");
  rootStyle.setProperty("--frame-h", fh + "px");
  document.documentElement.classList.toggle("narrow", fw < 600);
  relayout();
}

function applyOrientation(animate = false) {
  rootStyle.setProperty("--app-w", window.innerWidth + "px");
  rootStyle.setProperty("--app-h", window.innerHeight + "px");
  const forced = store.get().orientation === "landscape";
  $("rotate-button").classList.toggle("active", forced);
  $("rotate-button").setAttribute("aria-pressed", String(forced));

  const next = targetRotation();
  if (next === rotation) { setFrameVars(); return; }
  if (!animate || reduceMotion || rotating || !stage.animate) { setRotationClasses(next); setFrameVars(); return; }

  // sentido visual do giro: entrar em cw ou sair de ccw = horário (+); o contrário = anti-horário (−)
  const dir = next === "cw" || rotation === "ccw" ? 1 : -1;
  rotating = true;
  const out = stage.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `scale(0.9) rotate(${dir * 10}deg)` }],
    { duration: 170, easing: "ease-in", fill: "forwards" }
  );
  out.onfinish = () => {
    setRotationClasses(next);
    setFrameVars();
    const inn = stage.animate(
      [{ opacity: 0, transform: `scale(0.9) rotate(${-dir * 10}deg)` }, { opacity: 1, transform: "none" }],
      { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
    out.cancel();
    inn.onfinish = inn.oncancel = () => { rotating = false; };
  };
}

window.addEventListener("resize", () => applyOrientation(false));
window.addEventListener("orientationchange", () => setTimeout(() => applyOrientation(false), 250));

// troca rápida digital ⇄ analógico (só na aba Relógio)
$("face-button").addEventListener("click", () => {
  const c = store.get().clock;
  store.setClock({ type: c.type === "analog" ? "digital" : "analog" });
  showUI();
});

$("rotate-button").addEventListener("click", () => {
  const next = store.get().orientation === "landscape" ? "auto" : "landscape";
  pendingRotateAnim = true;
  store.set({ orientation: next });
  showUI();
});
let pendingRotateAnim = false;

// ---------------- Abas ----------------
const TABS = ["clock", "timer", "stopwatch", "pomodoro"];

function applyTab() {
  const tab = store.get().tab;
  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
  });
  document.documentElement.dataset.tab = tab;
  timers.setActiveTab(tab);
  pomodoro.setActive(tab === "pomodoro");
  if (tab === "clock") { relayout(); tick(); }
}

function updateTabDots() {
  document.querySelector('.tab[data-tab="timer"]').classList.toggle("running", timers.timerActive());
  document.querySelector('.tab[data-tab="stopwatch"]').classList.toggle("running", timers.stopwatchActive());
  document.querySelector('.tab[data-tab="pomodoro"]').classList.toggle("running", pomodoro.isActive());
}

function switchTab(delta) {
  const i = TABS.indexOf(store.get().tab);
  const next = TABS[(i + delta + TABS.length) % TABS.length];
  store.set({ tab: next });
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  store.set({ tab: b.dataset.tab });
  showUI();
});

/** Converte o movimento do dedo (tela física) para as direções do app (girado ou não). */
function toAppDelta(dxScreen, dyScreen) {
  if (rotation === "cw") return { dx: dyScreen, dy: dxScreen };    // topo do app = lado direito da tela
  if (rotation === "ccw") return { dx: -dyScreen, dy: -dxScreen }; // topo do app = lado esquerdo da tela
  return { dx: dxScreen, dy: -dyScreen };
}

// ---------------- Gestos: toque e swipe vertical ----------------
let gesture = null;

stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, input, select, a, label, .sw-laps")) return; // botões e lista de voltas
  gesture = {
    id: e.pointerId,
    startY: e.clientY,
    startX: e.clientX,
    startB: store.get().brightness,
    t0: performance.now(),
    moved: false,
  };
  try { stage.setPointerCapture(e.pointerId); } catch { /* ok */ }
});

stage.addEventListener("pointermove", (e) => {
  if (!gesture || e.pointerId !== gesture.id) return;
  const { dx, dy } = toAppDelta(e.clientX - gesture.startX, e.clientY - gesture.startY); // dy > 0 = para cima
  gesture.dx = dx;
  gesture.dy = dy;
  if (gesture.horizontal) return;
  if (!gesture.moved && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { gesture.horizontal = true; return; } // troca de aba
  if (!gesture.moved && Math.abs(dy) < 10) return;
  gesture.moved = true;
  const range = stage.clientHeight * 0.75;   // ~3/4 da tela vai de 5% a 100%
  const v = clamp(gesture.startB + dy / range, MIN_BRIGHTNESS, 1);
  gesture.value = v;
  applyBrightness(v);
  showBrightnessIndicator(v);
});

function endGesture(e) {
  if (!gesture || e.pointerId !== gesture.id) return;
  const g = gesture;
  gesture = null;
  if (g.moved) {
    if (g.value != null) store.set({ brightness: g.value });
  } else if (g.horizontal) {
    if (e.type === "pointerup" && Math.abs(g.dx) > 60) switchTab(g.dx < 0 ? 1 : -1);
  } else if (e.type === "pointerup" && performance.now() - g.t0 < 500) {
    toggleUI();
  }
  requestWakeLock(); // garante o wake lock a partir de um gesto do usuário
}
stage.addEventListener("pointerup", endGesture);
stage.addEventListener("pointercancel", endGesture);

// libera o áudio no primeiro toque (exigência dos navegadores)
document.addEventListener("pointerdown", () => sound.unlock(), { capture: true });

// evita zoom por gesto de pinça / duplo toque no iOS
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------- Proteção burn-in ----------------
function applyBurnIn() {
  if (!store.get().burnIn) {
    rootStyle.setProperty("--shift-x", "0px");
    rootStyle.setProperty("--shift-y", "0px");
    return;
  }
  const r = () => Math.round((Math.random() * 2 - 1) * BURN_IN_MAX_PX);
  rootStyle.setProperty("--shift-x", r() + "px");
  rootStyle.setProperty("--shift-y", r() + "px");
}
setInterval(applyBurnIn, BURN_IN_MS);

// ---------------- Laço do relógio ----------------
let lastMinute = -1;
function tick() {
  const now = new Date();
  updateFace(now);
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    applyTheme(now);
    location.tick();
    weather.tick();
  }
  return now;
}

function loop() {
  const now = tick();
  timers.tick(now.getTime());
  pomodoro.tick(now.getTime());
  sound.onTick(now, { night: nightActive(now) });
  // agenda para logo após a virada do próximo segundo
  setTimeout(loop, 1000 - (Date.now() % 1000) + 15);
}

// ---------------- Reação a mudanças nas configurações ----------------
store.subscribe((s, patch) => {
  if ("language" in patch) { applyLanguage(); mountFace(grid, true); timers.relabel(); pomodoro.relabel(); }
  if ("clock" in patch) document.documentElement.dataset.clock = s.clock.type;
  if ("pomo" in patch) pomodoro.render();
  if ("location" in patch) weather.tick();
  if ("tab" in patch) applyTab();
  if (["theme", "nightEnabled", "nightStart", "nightEnd", "face", "custom", "uiTheme"].some((k) => k in patch)) applyTheme();
  if ("orientation" in patch || "rotateDir" in patch) { applyOrientation(pendingRotateAnim || "orientation" in patch); pendingRotateAnim = false; }
  if ("burnIn" in patch) applyBurnIn();
  if ("brightness" in patch) applyBrightness(s.brightness);
  if (["face", "custom", "clock", "infoPosition", "presets"].some((k) => k in patch)) mountFace(grid);
  relayout();
  tick();
});
weather.subscribe(() => { relayout(); tick(); });

// ---------------- Início ----------------
applyLanguage();
applyTheme();
applyOrientation();
applyBrightness(store.get().brightness);
mountFace(grid, true);
initPicker();
timers.init({
  changed: updateTabDots,
  finished: () => { if (store.get().tab !== "timer") store.set({ tab: "timer" }); },
});
timers.mountTimer($("timer-view"));
timers.mountStopwatch($("stopwatch-view"));
pomodoro.init({
  changed: updateTabDots,
  finished: () => { if (store.get().tab !== "pomodoro") store.set({ tab: "pomodoro" }); },
});
pomodoro.mount($("pomodoro-view"));
document.documentElement.dataset.clock = store.get().clock.type;
applyTab();
updateTabDots();
settings.initSettings({ onClose: () => tick(), wakeLockState: () => wakeLockState });
weather.init();
applyBurnIn();
loop();
requestWakeLock();

// mostra os controles por alguns segundos na primeira abertura
showUI();
window.__nadaReady = true;

// Service worker: offline, instalação na Tela de Início e atualizações
update.init();
