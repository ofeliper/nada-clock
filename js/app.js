// NADA Clock — No Ads, Display Always
import * as store from "./store.js";
import * as weather from "./weather.js";
import { resolveLanguage, setLanguage, translateStatic, t, formatShortTime } from "./i18n.js";
import { mountFace, updateFace, relayout } from "./faces.js";
import * as settings from "./settings.js";
import { THEMES, resolveTheme, onSystemChange } from "./themes.js";
import * as sound from "./sound.js";
import * as timers from "./timer.js";
import * as pomodoro from "./pomodoro.js";
import * as location from "./location.js";
import * as update from "./update.js";
import { initPicker, openPicker } from "./picker.js";
import * as share from "./share.js";
import * as free from "./free.js";
import * as radial from "./radial.js";
import * as awake from "./awake.js";
import * as sysinfo from "./sysinfo.js";

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

/** Próxima vez (depois de agora) que o relógio marca hh:mm. */
function nextAt(hhmm, now = new Date()) {
  const m = toMinutes(hhmm);
  const d = new Date(now);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/** Modo noturno agora: o "Ligado/Desligado agora" do menu circular vale até o horário marcado. */
function nightOverride(now = new Date()) {
  const o = store.get().nightOverride;
  return o && now.getTime() < o.until ? o : null;
}
function nightNow(now = new Date()) {
  const s = store.get();
  const o = nightOverride(now);
  if (o) return o.mode === "on";
  return s.nightEnabled && isNightTime(now, s.nightStart, s.nightEnd);
}
function setNightMode(mode) {
  const s = store.get();
  if (mode === "on") store.set({ nightOverride: { mode, until: nextAt(s.nightEnd).getTime() } });
  else if (mode === "off") store.set({ nightOverride: { mode, until: nextAt(s.nightStart).getTime() } });
  else store.set({ nightOverride: null });
}

function applyTheme(now = new Date()) {
  const s = store.get();
  const nightTime = nightNow(now);
  const night = nightTime && s.nightColor !== false;   // usa a cor Noturno
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

  // brilho reduzido no horário noturno
  applyBrightness(store.get().brightness, now);
}

function nightActive(now = new Date()) {
  return nightNow(now);
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
function applyBrightness(v, now = new Date()) {
  const s = store.get();
  const cap = nightActive(now) ? Math.max(0.05, Number(s.nightBrightness) || 1) : 1;
  rootStyle.setProperty("--brightness", String(Math.min(v, cap)));
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

// ---------------- Tela sempre ligada (js/awake.js) ----------------
const requestWakeLock = () => awake.ensure();

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

// teclado: Tab mostra os controles (e os mantém visíveis enquanto há foco neles)
document.addEventListener("keydown", (e) => { if (e.key === "Tab" && !locked) showUI(); });
document.getElementById("topbar").addEventListener("focusin", () => { if (!locked) showUI(); });

$("settings-button").addEventListener("click", () => {
  hideUI();
  settings.open();
});

// ---------------- Modo espelho ----------------
function applyMirror() {
  document.documentElement.classList.toggle("mirror", !!store.get().mirror && !free.isEditing());
}

// ---------------- Bloqueio de toques ----------------
// Bloqueado: uma camada transparente segura todos os toques. Segurar 1,5 s desbloqueia.
const HOLD_MS = 1500;
let locked = false, holdTimer = 0, hintTimer = 0;
const shield = $("lock-shield");
const lockHint = $("lock-hint");
rootStyle.setProperty("--hold-ms", HOLD_MS + "ms");

function setLocked(on) {
  locked = on;
  shield.hidden = !on;
  document.documentElement.classList.toggle("locked", on);
  $("lock-button").classList.toggle("active", on);
  if (on) { hideUI(); flashLockHint(); }
  else { lockHint.classList.remove("visible", "holding"); showUI(); }
}

function flashLockHint() {
  lockHint.classList.add("visible");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { if (!holdTimer) lockHint.classList.remove("visible"); }, 2200);
}

$("lock-button").addEventListener("click", () => setLocked(true));
shield.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  sound.unlock();
  requestWakeLock();
  flashLockHint();
  lockHint.classList.remove("holding");
  void lockHint.offsetWidth;            // reinicia a animação do anel
  lockHint.classList.add("holding");
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { holdTimer = 0; setLocked(false); }, HOLD_MS);
});
const cancelHold = () => {
  if (!holdTimer) return;
  clearTimeout(holdTimer);
  holdTimer = 0;
  lockHint.classList.remove("holding");
  flashLockHint();
};
shield.addEventListener("pointerup", cancelHold);
shield.addEventListener("pointercancel", cancelHold);
shield.addEventListener("pointerleave", cancelHold);
shield.addEventListener("contextmenu", (e) => e.preventDefault());

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
// botão de mostradores: escolhe o modo sem abrir as configurações
$("face-button").addEventListener("click", () => {
  hideUI();
  openPicker({
    title: t("face.label"),
    options: store.MODES.map((m) => ({ value: m, label: t("mode." + m) })),
    value: store.currentMode(),
    onSelect: (m) => store.setMode(m),
  });
});

function toggleRotation() {
  const next = store.get().orientation === "landscape" ? "auto" : "landscape";
  pendingRotateAnim = true;
  store.set({ orientation: next });
}
$("rotate-button").addEventListener("click", () => { toggleRotation(); showUI(); });
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

/** Ponto da tela física → coordenadas do app (que pode estar girado). */
function toAppPoint(x, y) {
  if (rotation === "cw") return { x: y, y: innerWidth - x };
  if (rotation === "ccw") return { x: innerHeight - y, y: x };
  return { x, y };
}

// Segurar a tela: depois de um instante aparece um anel que vai enchendo;
// ao completar, abre o menu circular em volta do dedo (js/radial.js).
const HOLD_EDIT_DELAY = 180, HOLD_EDIT_MS = 450;
const holdEdit = $("hold-edit");
rootStyle.setProperty("--hold-edit-ms", HOLD_EDIT_MS + "ms");

function startHoldEdit(g, el, e) {
  const p = toAppPoint(e.clientX, e.clientY);
  // um pouco acima do dedo, para não ficar escondido
  const top = p.y - 64 < 40 ? p.y + 64 : p.y - 64;
  g.holdTimers = [
    setTimeout(() => {
      holdEdit.style.left = p.x + "px";
      holdEdit.style.top = top + "px";
      holdEdit.classList.add("visible");
      requestAnimationFrame(() => holdEdit.classList.add("filling"));
    }, HOLD_EDIT_DELAY),
    setTimeout(() => {
      g.holdDone = true;
      cancelHoldEdit(g);
      try { navigator.vibrate?.(12); } catch { /* ok */ }
      hideUI();
      radial.openAt(g.lastX ?? e.clientX, g.lastY ?? e.clientY, {
        target: el ? { id: el.dataset.id, label: el.dataset.placeholder || "" } : null,
      });
    }, HOLD_EDIT_DELAY + HOLD_EDIT_MS),
  ];
}

function cancelHoldEdit(g) {
  if (g?.holdTimers) g.holdTimers.forEach(clearTimeout);
  if (g) g.holdTimers = null;
  holdEdit.classList.remove("visible", "filling");
}

stage.addEventListener("pointerdown", (e) => {
  if (free.isEditing()) return;                  // o editor cuida dos toques
  if (e.target.closest("button, input, select, a, label, .sw-laps, .tm-list")) return; // botões e lista de voltas
  gesture = {
    id: e.pointerId,
    startY: e.clientY,
    startX: e.clientX,
    startB: store.get().brightness,
    t0: performance.now(),
    moved: false,
  };
  if (radial.isOpen()) radial.close();
  const iel = store.get().face === "interactive" && store.get().tab === "clock" ? e.target.closest(".iel") : null;
  startHoldEdit(gesture, iel, e);
  try { stage.setPointerCapture(e.pointerId); } catch { /* ok */ }
});

stage.addEventListener("pointermove", (e) => {
  if (!gesture || e.pointerId !== gesture.id) return;
  gesture.lastX = e.clientX;
  gesture.lastY = e.clientY;
  if (gesture.holdDone) { radial.dragMove(e.clientX, e.clientY); return; }
  const { dx, dy } = toAppDelta(e.clientX - gesture.startX, e.clientY - gesture.startY); // dy > 0 = para cima
  gesture.dx = dx;
  gesture.dy = dy;
  if (gesture.holdTimers && Math.hypot(dx, dy) > 10) cancelHoldEdit(gesture);
  if (gesture.holdDone) return;
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
  cancelHoldEdit(g);
  if (g.holdDone) { radial.dragEnd(e.clientX, e.clientY, e.type !== "pointerup"); return; } // virou menu circular
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
// reserva: se o "soltar" não chegar ao palco (iOS, com o menu circular aparecendo sob o dedo)
window.addEventListener("pointerup", (e) => { if (gesture && e.pointerId === gesture.id) endGesture(e); });
window.addEventListener("pointercancel", (e) => { if (gesture && e.pointerId === gesture.id) endGesture(e); });
window.addEventListener("touchend", (e) => {
  if (gesture?.holdDone && e.touches.length === 0) {
    const tch = e.changedTouches[0];
    endGesture({ pointerId: gesture.id, type: "pointerup", clientX: tch?.clientX ?? gesture.lastX, clientY: tch?.clientY ?? gesture.lastY });
  }
});

// libera o áudio no primeiro toque (exigência dos navegadores)
document.addEventListener("pointerdown", () => sound.unlock(), { capture: true });

// evita zoom por gesto de pinça / duplo toque no iOS
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------- Proteção burn-in ----------------
function applyBurnIn() {
  if (!store.get().burnIn || free.isEditing()) {
    rootStyle.setProperty("--shift-x", "0px");
    rootStyle.setProperty("--shift-y", "0px");
    return;
  }
  const r = () => Math.round((Math.random() * 2 - 1) * BURN_IN_MAX_PX);
  rootStyle.setProperty("--shift-x", r() + "px");
  rootStyle.setProperty("--shift-y", r() + "px");
}
setInterval(applyBurnIn, BURN_IN_MS);

// ---------------- Mostrador Interativo ----------------
function applyFace() {
  const s = store.get();
  document.documentElement.dataset.face = s.face;
  if (s.face === "interactive") free.mount();
}

/** Ícone do botão digital/analógico: no Interativo, segue o primeiro relógio da tela. */
function applyClockType() {
  const s = store.get();
  let type = s.clock.type;
  if (s.face === "interactive") type = s.interactive?.elements?.find((e) => e.type === "clock")?.opts?.type || "digital";
  document.documentElement.dataset.clock = type;
}

function startEditing(selectId = null) {
  if (locked) return;
  if (store.get().face !== "interactive") store.set({ face: "interactive" });
  if (store.get().tab !== "clock") store.set({ tab: "clock" });
  hideUI();
  rootStyle.setProperty("--shift-x", "0px");
  rootStyle.setProperty("--shift-y", "0px");
  requestAnimationFrame(() => { free.startEditing(typeof selectId === "string" ? selectId : null); applyMirror(); });
}

// ---------------- Laço do relógio ----------------
let lastMinute = -1;
function tick() {
  const now = new Date();
  if (store.get().face === "interactive") free.update(now); else updateFace(now);
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
  if ("language" in patch) { applyLanguage(); mountFace(grid, true); free.relabel?.(); timers.relabel(); pomodoro.relabel(); }
  if ("clock" in patch || "interactive" in patch || "face" in patch) applyClockType();
  if ("face" in patch) applyFace();
  if ("pomo" in patch) pomodoro.render();
  if ("location" in patch) weather.tick();
  if ("tab" in patch) applyTab();
  if (["theme", "nightEnabled", "nightStart", "nightEnd", "nightOverride", "face", "custom", "uiTheme"].some((k) => k in patch)) applyTheme();
  if ("language" in patch) radial.refresh();
  if ("orientation" in patch || "rotateDir" in patch) { applyOrientation(pendingRotateAnim || "orientation" in patch); pendingRotateAnim = false; }
  if ("burnIn" in patch) applyBurnIn();
  if ("mirror" in patch) applyMirror();
  if (["nightBrightness", "nightColor"].some((k) => k in patch)) applyTheme();
  if ("brightness" in patch) applyBrightness(s.brightness);
  if (["face", "custom", "clock", "infoPosition", "presets"].some((k) => k in patch)) mountFace(grid);
  if (["face", "interactive", "language"].some((k) => k in patch) && s.face === "interactive") free.mount("language" in patch);
  relayout();
  tick();
});
weather.subscribe(() => { relayout(); tick(); });

// ---------------- Início ----------------
applyLanguage();
applyMirror();
applyTheme();
applyOrientation();
applyBrightness(store.get().brightness);
mountFace(grid, true);
initPicker();
free.init({
  // movimento do dedo → coordenadas do app (com y para baixo)
  mapPointerDelta: (dx, dy) => { const d = toAppDelta(dx, dy); return { dx: d.dx, dy: -d.dy }; },
  exited: () => { applyMirror(); applyBurnIn(); applyClockType(); showUI(); },
});
applyFace();
$("edit-button").addEventListener("click", startEditing);

radial.init({
  toAppPoint,
  state: () => {
    const s = store.get();
    const o = nightOverride();
    return {
      interactive: s.face === "interactive",
      mode: store.currentMode(),
      tab: s.tab,
      night: o ? o.mode : "auto",
      nightUntil: o ? formatShortTime(new Date(o.until)) : "",
      brightness: s.brightness,
      minBrightness: MIN_BRIGHTNESS,
    };
  },
  brightness: (v, commit) => {
    if (commit) store.set({ brightness: v });
    else applyBrightness(v);
  },
  act: (id, { target }) => {
    const [kind, value] = id.split(":");
    switch (kind) {
      case "edit": startEditing(target?.id || null); break;
      case "mode": store.setMode(value); break;
      case "tab": store.set({ tab: value }); break;
      case "night": setNightMode(value); break;
      case "lock": setLocked(true); break;
      case "rotate": toggleRotation(); break;
      case "settings": settings.open(); break;
    }
  },
});
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
applyClockType();
applyTab();
updateTabDots();
settings.initSettings({ onClose: () => tick(), wakeLockState: () => awake.getState(), editScreen: startEditing });
weather.init();
applyBurnIn();
loop();
awake.init({ changed: () => settings.refresh() });

// mostra os controles por alguns segundos na primeira abertura
showUI();
window.__nadaReady = true;

// Service worker: offline, instalação na Tela de Início e atualizações
sysinfo.noteVersion(settings.VERSION);
sysinfo.provide({
  version: () => settings.VERSION,
  face: () => t("mode." + store.currentMode()),
  clock: () => {
    const s = store.get();
    const c = s.face === "interactive" ? s.interactive?.elements?.find((e) => e.type === "clock")?.opts : s.clock;
    if (!c) return t("sys.none");
    if (c.type === "analog") return t("center.analog");
    return `${t("center.digital")} · ${c.hour12 ? "12h" : "24h"}`;
  },
  brightness: () => Math.round((store.get().brightness ?? 1) * 100) + "%",
  night: () => {
    const s = store.get();
    const o = nightOverride();
    if (o) return t(o.mode === "on" ? "sys.nightOnUntil" : "sys.nightOffUntil", { time: formatShortTime(new Date(o.until)) });
    if (!s.nightEnabled) return t("sys.nightDisabled");
    return nightNow()
      ? t("sys.nightOnUntil", { time: formatShortTime(nextAt(s.nightEnd)) })
      : t("sys.nightScheduled", { start: s.nightStart, end: s.nightEnd });
  },
  awake: () => {
    const st = awake.getState();
    return t(st === "on" ? "sys.awakeOn" : st === "video" ? "sys.awakeVideo" : "sys.awakeOff");
  },
  orientation: () => t(rotation !== "none" ? "sys.orientRotated" : innerHeight > innerWidth ? "sys.orientPortrait" : "sys.orientLandscape"),
});
update.init({ version: settings.VERSION });

// Layout compartilhado por link (#p=...)
function checkSharedLink() {
  const shared = share.readSharedFromUrl();
  if (!shared) return;
  const box = $("share-prompt");
  box.querySelector("[data-text]").textContent = shared.name
    ? t("share.received", { name: shared.name }) : t("share.receivedNoName");
  box.hidden = false;
  box.onclick = (e) => {
    const b = e.target.closest("[data-share]");
    if (!b) return;
    if (b.dataset.share === "apply") share.applyShared(shared, t("share.receivedPreset"));
    box.hidden = true;
  };
}
checkSharedLink();
window.addEventListener("hashchange", checkSharedLink);
