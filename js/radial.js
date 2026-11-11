// Menu circular: segurar a tela abre um anel de opções em volta do dedo.
//
// Dois jeitos de usar:
//   • rápido: sem soltar, deslize na direção da opção e solte (vale a direção);
//   • calmo: solte no meio; o menu fica aberto para tocar. O ✕ do centro (ou fora do anel) fecha.
// Opções com ▸ abrem um segundo anel (com "Voltar"). O Brilho abre um anel de girar.
import { t } from "./i18n.js";

const R1 = 46;           // raio do centro
const R2 = 130;          // raio externo
const MARGIN = 8;
const GAP = 0.035;       // folga entre fatias (rad)
const DIAL_FROM = 135;   // anel do brilho: de 135° (embaixo à esquerda)...
const DIAL_SWEEP = 270;  // ...girando 270° no sentido horário

const svgIcon = (d, extra = "") => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICONS = {
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  faces: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
  tools: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M3.5 6.5l3-3M20.5 6.5l-3-3"/>',
  bright: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  rotate: '<rect x="7.5" y="3" width="9" height="15" rx="2"/><path d="M3 13.5a9 9 0 0 0 8 7.4"/><path d="M8.6 18.4l2.4 2.5-2.6 2.1"/>',
  settings: '<path fill="currentColor" stroke="none" d="M19.14 12.94a7.07 7.07 0 0 0 .05-.94 7.07 7.07 0 0 0-.05-.94l2.03-1.58a.49.49 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54a7.36 7.36 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.62l2.03 1.58a7.24 7.24 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.25.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54a7.36 7.36 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.62l-2.03-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  close: '<path d="M7 7l10 10M17 7 7 17"/>',
  "minimal-digital": '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M7 10v4M10 10v4M14 10v4h3v-4h-3"/>',
  "minimal-analog": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  custom: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17"/>',
  interactive: '<path d="M4.5 4.5h7v7h-7zM14 13l6.5 3-2.8 1.2L16.5 20z"/><path d="M14.5 5h5M14.5 8.5h3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  timer: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/>',
  pomodoro: '<path d="M12 7c-4.4 0-7.5 2.9-7.5 6.6S7.6 21 12 21s7.5-3.7 7.5-7.4S16.4 7 12 7Z"/><path d="M12 7V3.5M12 7c-1.5-1.8-3.5-2.2-5-1.5M12 7c1.5-1.8 3.5-2.2 5-1.5"/>',
  "night-auto": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/><path d="M19 4.5a3 3 0 1 0 2 5.2 3.6 3.6 0 0 1-2-5.2Z" fill="currentColor"/>',
  "night-on": '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor"/>',
  "night-off": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"/><path d="M4 4l16 16"/>',
};

let root, svg, hooks;
let menu = null;   // { cx, cy, level, items, hi, mode: "drag"|"tap", target, dial }

export const isOpen = () => !!menu;

/**
 * hooks:
 *   toAppPoint(clientX, clientY) → {x, y} nas coordenadas do app (que pode estar girado)
 *   state() → { interactive, mode, tab, night: "auto"|"on"|"off", nightUntil, brightness, minBrightness }
 *   act(id, value) → executa a ação
 *   brightness(v, commit) → aplica o brilho (commit = salvar)
 */
export function init(h) {
  hooks = h;
  root = document.getElementById("radial");
  svg = root.querySelector("svg");
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", () => { if (menu) menu.press = null; });
  // reserva: alguns navegadores (iOS) às vezes não entregam o pointerup; o click sempre chega
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", (e) => {
    if (!menu) return;
    if (e.key === "Escape") { e.preventDefault(); menu.level === "main" ? close() : show("main"); }
  }, true);
}

// ---------------- Itens de cada anel ----------------
function itemsFor(level) {
  const s = hooks.state();
  const item = (id, label, extra = {}) => ({ id, label, icon: ICONS[extra.icon || id], ...extra });
  const back = item("back", t("radial.back"));
  switch (level) {
    case "faces":
      return [back, ...["minimal-digital", "minimal-analog", "custom", "interactive"].map((m) =>
        item("mode:" + m, t("radial.mode." + m), { icon: m, current: s.mode === m }))];
    case "tools":
      return [back, ...["clock", "timer", "stopwatch", "pomodoro"].map((tab) =>
        item("tab:" + tab, t("tab." + tab), { icon: tab, current: s.tab === tab }))];
    case "night":
      return [back, ...["auto", "on", "off"].map((m) =>
        item("night:" + m, t("radial.night." + m), { icon: "night-" + m, current: s.night === m }))];
    default: {
      const list = [];
      if (s.interactive) list.push(item("edit", t(menu?.target ? "radial.editItem" : "radial.editScreen")));
      list.push(
        item("faces", t("radial.faces"), { sub: true }),
        item("tools", t("radial.tools"), { sub: true }),
        item("bright", t("radial.brightness"), { sub: true }),
        item("night", t("radial.night"), { sub: true }),
        item("lock", t("radial.lock")),
        item("rotate", t("radial.rotate")),
        item("settings", t("radial.settings")),
      );
      return list;
    }
  }
}

function centerText() {
  const s = hooks.state();
  const hiItem = menu.hi >= 0 ? menu.items[menu.hi] : null;
  if (menu.level === "main") {
    if (hiItem?.id === "edit" && menu.target) return [t("radial.edit"), menu.target.label];
    return hiItem ? [hiItem.label] : null;
  }
  if (hiItem) return [hiItem.label];
  if (menu.level === "night") {
    if (s.night === "auto") return [t("radial.night.auto")];
    return [t("radial.night." + s.night), t("radial.until", { time: s.nightUntil })];
  }
  if (menu.level === "tools") return [t("tab." + s.tab), t("radial.current")];
  if (menu.level === "faces") return [t("radial.mode." + s.mode), t("radial.current")];
  return null;
}

// ---------------- Abrir / fechar ----------------

/** Abre no ponto do dedo (coordenadas da tela). target = elemento do Interativo embaixo do dedo. */
export function openAt(clientX, clientY, { target = null } = {}) {
  const p = hooks.toAppPoint(clientX, clientY);
  const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
  const lim = R2 + MARGIN;
  menu = {
    cx: Math.min(Math.max(p.x, lim), Math.max(lim, W - lim)),
    cy: Math.min(Math.max(p.y, lim), Math.max(lim, H - lim)),
    ox: p.x, oy: p.y,   // onde o dedo estava ao abrir (o menu pode ter sido empurrado para caber)
    mode: "drag", target, hi: -1, level: "main", items: [],
  };
  root.hidden = false;
  document.documentElement.classList.add("radial-open");
  show("main");
  requestAnimationFrame(() => root.classList.add("visible"));
}

export function close() {
  if (!menu) return;
  menu = null;
  root.classList.remove("visible");
  document.documentElement.classList.remove("radial-open");
  root.hidden = true;
  svg.innerHTML = "";
}

function show(level) {
  menu.level = level;
  menu.hi = -1;
  menu.items = level === "bright" ? [] : itemsFor(level);
  render();
}

/** Atualiza textos (idioma, estado) se estiver aberto. */
export function refresh() { if (menu) { menu.items = menu.level === "bright" ? [] : itemsFor(menu.level); render(); } }

// ---------------- Desenho ----------------
function polar(r, a) { return [menu.cx + r * Math.cos(a), menu.cy + r * Math.sin(a)]; }
const START = -Math.PI / 2;
const step = () => (2 * Math.PI) / menu.items.length;

function render() {
  const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  let g = "";
  if (menu.level === "bright") g = renderDial();
  else {
    menu.items.forEach((it, i) => {
      const a = START + i * step();
      const a0 = a - step() / 2 + GAP, a1 = a + step() / 2 - GAP;
      const [x1, y1] = polar(R2, a0), [x2, y2] = polar(R2, a1), [x3, y3] = polar(R1 + 4, a1), [x4, y4] = polar(R1 + 4, a0);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const on = i === menu.hi;
      g += `<path class="rm-slice${on ? " on" : ""}${it.current ? " current" : ""}" d="M${x1} ${y1}A${R2} ${R2} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${R1 + 4} ${R1 + 4} 0 ${large} 0 ${x4} ${y4}Z"/>`;
      const [ix, iy] = polar((R1 + R2) / 2 + 3, a);
      g += `<g class="rm-ic${on ? " on" : ""}" transform="translate(${ix - 12} ${iy - 20})">${svgIcon(it.icon)}</g>`;
      g += `<text class="rm-label${on ? " on" : ""}" x="${ix}" y="${iy + 20}" text-anchor="middle">${esc(it.label)}${it.sub ? " ›" : ""}</text>`;
      if (it.current) {
        const [dx, dy] = polar(R2 - 10, a);
        g += `<circle class="rm-dot" cx="${dx}" cy="${dy}" r="3.2"/>`;
      }
    });
    g += centerCircle(centerText());
  }
  svg.innerHTML = g;
}

function centerCircle(lines) {
  let g = `<circle class="rm-center" cx="${menu.cx}" cy="${menu.cy}" r="${R1 - 4}"/>`;
  if (lines) {
    lines.forEach((txt, k) => {
      const y = menu.cy + (k - (lines.length - 1) / 2) * 15 + 4;
      const size = k ? 10.5 : (txt.length > 11 ? 10.5 : txt.length > 8 ? 11.5 : 13);
      g += `<text class="rm-center-t${k ? " sub" : ""}" x="${menu.cx}" y="${y}" text-anchor="middle" font-size="${size}">${esc(txt)}</text>`;
    });
  } else {
    g += `<g class="rm-ic" transform="translate(${menu.cx - 12} ${menu.cy - 12})">${svgIcon(ICONS.close)}</g>`;
  }
  return g;
}

// ----- anel de girar do brilho -----
const rad = (d) => (d * Math.PI) / 180;
function valueToDeg(v) {
  const s = hooks.state();
  const k = (v - s.minBrightness) / (1 - s.minBrightness);
  return DIAL_FROM + Math.min(1, Math.max(0, k)) * DIAL_SWEEP;
}
function degToValue(deg) {
  const s = hooks.state();
  let rel = (((deg - DIAL_FROM) % 360) + 360) % 360;
  if (rel > DIAL_SWEEP) rel = rel > DIAL_SWEEP + (360 - DIAL_SWEEP) / 2 ? 0 : DIAL_SWEEP;  // vão de baixo: vai para a ponta mais perto
  return s.minBrightness + (rel / DIAL_SWEEP) * (1 - s.minBrightness);
}
function arcPath(r, d0, d1) {
  const [x0, y0] = polar(r, rad(d0)), [x1, y1] = polar(r, rad(d1));
  return `M${x0} ${y0}A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
function renderDial() {
  const s = hooks.state();
  const v = menu.dial ?? s.brightness;
  const r = (R1 + R2) / 2 + 6, w = 22;
  const end = valueToDeg(v);
  const [kx, ky] = polar(r, rad(end));
  const [sx, sy] = polar(r + w / 2 + 14, rad(DIAL_FROM - 8)), [bx, by] = polar(r + w / 2 + 14, rad(DIAL_FROM + DIAL_SWEEP + 8));
  let g = `<circle class="rm-dial-bg" cx="${menu.cx}" cy="${menu.cy}" r="${R2}"/>`;
  g += `<path class="rm-track" d="${arcPath(r, DIAL_FROM, DIAL_FROM + DIAL_SWEEP)}" stroke-width="${w}"/>`;
  if (end > DIAL_FROM + 0.5) g += `<path class="rm-fill" d="${arcPath(r, DIAL_FROM, end)}" stroke-width="${w}"/>`;
  g += `<circle class="rm-knob" cx="${kx}" cy="${ky}" r="${w / 2 + 4}"/>`;
  g += `<g class="rm-ic small" transform="translate(${sx - 8} ${sy - 8}) scale(0.67)">${svgIcon(ICONS.bright)}</g>`;
  g += `<g class="rm-ic" transform="translate(${bx - 12} ${by - 12})">${svgIcon(ICONS.bright)}</g>`;
  g += `<circle class="rm-center" cx="${menu.cx}" cy="${menu.cy}" r="${R1 - 4}"/>`;
  g += `<text class="rm-center-t" x="${menu.cx}" y="${menu.cy + 3}" text-anchor="middle" font-size="17">${Math.round(v * 100)}%</text>`;
  g += `<text class="rm-center-t sub" x="${menu.cx}" y="${menu.cy + 20}" text-anchor="middle" font-size="10.5">‹ ${esc(t("radial.back"))}</text>`;
  return g;
}

// ---------------- Toques ----------------
function locate(clientX, clientY) {
  const p = hooks.toAppPoint(clientX, clientY);
  const dx = p.x - menu.cx, dy = p.y - menu.cy;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  return { dist, ang };
}
function sliceAt(ang) {
  const n = menu.items.length;
  return ((Math.round((ang - START) / step()) % n) + n) % n;
}

/** Modo rápido: vale a direção em que o dedo andou desde que o menu abriu. */
const DRAG_MIN = 28;
function dragSlice(clientX, clientY) {
  const p = hooks.toAppPoint(clientX, clientY);
  const dx = p.x - menu.ox, dy = p.y - menu.oy;
  return Math.hypot(dx, dy) > DRAG_MIN ? sliceAt(Math.atan2(dy, dx)) : -1;
}

/** Movimento do dedo ainda pressionado desde que o menu abriu (modo rápido). */
export function dragMove(clientX, clientY) {
  if (!menu || menu.mode !== "drag") return;
  const hi = dragSlice(clientX, clientY);
  if (hi !== menu.hi) { menu.hi = hi; render(); }
}

/** Soltou o dedo do gesto de abrir: escolhe a opção apontada, ou deixa o menu aberto. */
export function dragEnd(clientX, clientY, cancelled = false) {
  if (!menu || menu.mode !== "drag") return;
  menu.mode = "tap";
  menu.handledAt = performance.now();   // ignora o click que o navegador gera ao soltar
  if (cancelled) { menu.hi = -1; render(); return; }
  const hi = dragSlice(clientX, clientY);
  if (hi >= 0) activate(hi);
  else { menu.hi = -1; render(); }
}

function onDown(e) {
  if (!menu) return;
  // o "soltar" do dedo que abriu o menu se perdeu (acontece no iOS): passa para o modo calmo
  if (menu.mode === "drag") { menu.mode = "tap"; menu.hi = -1; render(); }
  e.preventDefault();
  e.stopPropagation();
  try { root.setPointerCapture(e.pointerId); } catch { /* ok */ }
  const { dist, ang } = locate(e.clientX, e.clientY);
  if (menu.level === "bright") {
    if (dist < R1) { menu.press = { center: true }; return; }
    if (dist > R2) { menu.press = { outside: true }; return; }
    menu.press = { dial: true };
    setDial(ang);
    return;
  }
  if (dist < R1) menu.press = { center: true };
  else if (dist > R2) menu.press = { outside: true };
  else { menu.press = { slice: sliceAt(ang) }; menu.hi = menu.press.slice; render(); }
}

function onMove(e) {
  if (!menu?.press) return;
  const { dist, ang } = locate(e.clientX, e.clientY);
  if (menu.press.dial) { setDial(ang); return; }
  if (menu.press.slice != null) {
    const hi = dist > R1 && dist < R2 + 24 ? sliceAt(ang) : -1;
    if (hi !== menu.hi) { menu.hi = hi; render(); }
  }
}

function onUp(e) {
  if (!menu?.press) return;
  const press = menu.press;
  menu.press = null;
  menu.handledAt = performance.now();
  const { dist, ang } = locate(e.clientX, e.clientY);
  if (press.dial) { hooks.brightness(menu.dial, true); return; }
  if (press.center) { centerTap(); return; }
  if (press.outside) { close(); return; }
  if (press.slice != null && dist > R1 && dist <= R2 + 24) activate(sliceAt(ang));
  else { menu.hi = -1; render(); }
}

function centerTap() {
  if (menu.level === "bright") show("main");
  else close();
}

/** Reserva para quando o pointerdown/pointerup não chegou: trata o toque pelo click. */
function onClick(e) {
  if (!menu) return;
  if (menu.handledAt && performance.now() - menu.handledAt < 600) return;  // já tratado
  menu.mode = "tap";
  menu.press = null;
  const { dist, ang } = locate(e.clientX, e.clientY);
  if (dist < R1) centerTap();
  else if (dist > R2) close();
  else if (menu.level !== "bright") activate(sliceAt(ang));
}

function setDial(ang) {
  const v = degToValue((ang * 180) / Math.PI);
  menu.dial = Math.round(v * 100) / 100;
  hooks.brightness(menu.dial, false);
  render();
}

function activate(i) {
  const it = menu.items[i];
  if (!it) return;
  if (it.id === "back") { show("main"); return; }
  if (it.sub) {
    menu.mode = "tap";
    if (it.id === "bright") menu.dial = hooks.state().brightness;
    show(it.id);
    return;
  }
  const target = menu.target;
  close();
  hooks.act(it.id, { target });
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
