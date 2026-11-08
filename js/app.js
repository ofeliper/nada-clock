// NADA Clock — No Ads, Display Always
import * as store from "./store.js";
import * as weather from "./weather.js";
import { resolveLanguage, setLanguage, translateStatic } from "./i18n.js";
import { mountFace, updateFace, relayout } from "./faces.js";
import * as settings from "./settings.js";

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

function applyTheme(now = new Date()) {
  const s = store.get();
  const theme = s.nightEnabled && isNightTime(now, s.nightStart, s.nightEnd) ? "night" : s.theme;
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
  }
}

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

// ---------------- Gestos: toque e swipe vertical ----------------
let gesture = null;

stage.addEventListener("pointerdown", (e) => {
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
  const dy = gesture.startY - e.clientY;     // para cima = positivo
  const dx = e.clientX - gesture.startX;
  if (!gesture.moved && Math.abs(dy) < 10) return;
  if (!gesture.moved && Math.abs(dx) > Math.abs(dy)) return; // horizontal: reservado (abas no futuro)
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
  } else if (e.type === "pointerup" && performance.now() - g.t0 < 500) {
    toggleUI();
  }
  requestWakeLock(); // garante o wake lock a partir de um gesto do usuário
}
stage.addEventListener("pointerup", endGesture);
stage.addEventListener("pointercancel", endGesture);

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
    weather.tick();
  }
}

function loop() {
  tick();
  // agenda para logo após a virada do próximo segundo
  setTimeout(loop, 1000 - (Date.now() % 1000) + 15);
}

// ---------------- Reação a mudanças nas configurações ----------------
store.subscribe((s, patch) => {
  if ("language" in patch) applyLanguage();
  if ("theme" in patch || "nightEnabled" in patch || "nightStart" in patch || "nightEnd" in patch) applyTheme();
  if ("burnIn" in patch) applyBurnIn();
  if ("brightness" in patch) applyBrightness(s.brightness);
  relayout();
  tick();
});
weather.subscribe(() => tick());

// ---------------- Início ----------------
applyLanguage();
applyTheme();
applyBrightness(store.get().brightness);
mountFace(store.get().face, grid);
settings.initSettings({ onClose: () => tick(), wakeLockState: () => wakeLockState });
weather.init();
applyBurnIn();
loop();
requestWakeLock();

// mostra os controles por alguns segundos na primeira abertura
showUI();

// Service worker: funciona offline e permite instalar na Tela de Início
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* segue sem offline */ });
}
