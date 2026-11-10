// Mostrador Interativo (beta): elementos livres, editados direto na tela.
//
// Cada elemento: { id, type, x, y, size, align, opacity, color, font, opts }
//   x, y   → posição em % da "tela" (canvas)
//   size   → tamanho da fonte em % da largura da tela
//   opts   → opções do tipo (relógio: digital/analógico, fonte…; fuso: zona…)
// A tela guarda a proporção (ar) de quando foi editada. Na outra orientação, ela é
// encaixada inteira (como uma foto), então o desenho nunca se desmonta.
import * as store from "./store.js";
import { t } from "./i18n.js";
import { createClock, createSlotComponent, SLOT_TYPES, ZONES, zoneCity, WEATHER_EXTRAS } from "./components.js";
import { TOKENS, expand } from "./tokens.js";
import { enhanceSelects, handleSelectTap } from "./picker.js";

export const ELEMENT_TYPES = ["clock", ...SLOT_TYPES.filter((x) => x !== "empty")];
const COLORS = [null, "#33ff66", "#ffb000", "#e8e8e8", "#5ac8fa", "#b3261e", "#ff7eb6", "#b69cff", "#2b2b2b"];
const FONTS = ["rounded", "thin", "regular", "bold", "mono"];
const CLOCK_FONTS = ["rounded", "thin", "regular", "bold", "mono", "led"];
const SNAP = 1.4;               // distância (em %) para o "ímã"
const MARGIN = 3;               // margens laterais (em %)
const MAX_ELEMENTS = 16;

const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (str) => String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TYPE_DEFAULTS = {
  timezone: () => ({ zone: "Europe/Lisbon", label: "" }),
  progress: () => ({ mode: "day" }),
  moon: () => ({ hemisphere: "auto", showName: true }),
  countdown: () => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    const p = (n) => String(n).padStart(2, "0");
    return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, label: "" };
  },
  text: () => ({ text: "{weekday}" }),
};

// ---------------- Estado ----------------
let root, canvas, guideV, guideH;
let mounted = new Map();       // id → { el, comp }
let mountedKey = "";
let editing = false;
let draft = null;              // cópia do layout durante a edição
let selectedId = null;
let scale = 1;                 // na edição, a tela inteira aparece reduzida ao lado da gaveta
let resetArmed = false;
let mapDelta = (dx, dy) => ({ dx, dy });   // tela física → coordenadas do app (giro forçado)
let onExit = null;

let editOrient = "land";        // orientação do layout sendo editado
let mountedOrient = "";

/** "land" (deitado) ou "port" (em pé), pela área disponível. */
const orient = () => (root && root.clientHeight > root.clientWidth ? "port" : "land");
/** Layout salvo para uma orientação. Em pé sem layout próprio: o deitado esticado na tela toda. */
function stored(o = orient()) {
  const it = store.get().interactive;
  if (o !== "port") return it;
  return it.port || { ...it, ar: 0 };
}
const layout = () => (editing ? draft : stored());
const findEl = (id) => layout().elements.find((e) => e.id === id);

export const isEditing = () => editing;

export function init({ mapPointerDelta, exited }) {
  root = document.getElementById("free");
  root.innerHTML = '<div class="free-canvas"></div>';
  canvas = root.querySelector(".free-canvas");
  guideV = Object.assign(document.createElement("div"), { className: "guide guide-v", hidden: true });
  guideH = Object.assign(document.createElement("div"), { className: "guide guide-h", hidden: true });
  if (mapPointerDelta) mapDelta = mapPointerDelta;
  onExit = exited;
  bindEditing();
  bindUi();
  new ResizeObserver(() => fit()).observe(root);
}

// ---------------- Renderização ----------------

/** Monta os elementos (só se algo mudou, a não ser que force). */
export function mount(force = false) {
  if (!root) return;
  const lay = layout();
  mountedOrient = orient();
  const key = JSON.stringify(lay) + "|" + editing;
  if (!force && key === mountedKey) { fit(); return; }
  mountedKey = key;

  for (const { comp } of mounted.values()) comp?.destroy?.();
  mounted.clear();
  canvas.replaceChildren();
  for (const data of lay.elements) {
    const el = document.createElement("div");
    el.className = "iel";
    el.dataset.id = data.id;
    el.dataset.type = data.type;
    el.dataset.placeholder = label(data.type);
    el.tabIndex = editing ? 0 : -1;
    const body = document.createElement("div");
    body.className = "iel-body";
    el.appendChild(body);
    const comp = data.type === "clock" ? createClock(data.opts || {}) : createSlotComponent({ type: data.type, ...(data.opts || {}) });
    comp?.mount(body);
    canvas.appendChild(el);
    mounted.set(data.id, { el, comp });
  }
  canvas.append(guideV, guideH);
  fit();
  update(new Date());
  markSelected();
}

/** Encaixa a tela na área disponível e aplica posição/tamanho/cor de cada elemento. */
export function fit() {
  if (!root) return;
  const fw = root.clientWidth, fh = root.clientHeight;
  if (!fw || !fh) return;
  if (!editing && orient() !== mountedOrient) { mount(true); return; }
  const ar = layout().ar || fw / fh;
  let cw, ch, left, top;
  scale = 1;
  if (editing) {
    // tela inteira, reduzida para caber ao lado (deitado) ou acima (em pé) da gaveta
    cw = fw; ch = fh;
    const bottom = orient() === "port";
    document.documentElement.classList.toggle("edit-bottom", bottom);
    const drawer = document.querySelector(".edit-drawer");
    const gap = 14;
    const aw = bottom ? fw : fw - (drawer?.offsetWidth || 0) - gap;
    const ah = bottom ? fh - (drawer?.offsetHeight || 0) - gap : fh;
    scale = Math.min(1, aw / fw, ah / fh) * 0.97;
    left = (aw - fw * scale) / 2;
    top = (ah - fh * scale) / 2;
  } else if (fw / fh > ar) { ch = fh; cw = fh * ar; }
  else { cw = fw; ch = fw / ar; }
  if (!editing) { left = (fw - cw) / 2; top = (fh - ch) / 2; }
  Object.assign(canvas.style, {
    width: cw + "px", height: ch + "px", left: left + "px", top: top + "px",
    transform: scale === 1 ? "" : `scale(${scale})`,
  });
  canvas.style.setProperty("--edit-scale", scale);
  canvas.dataset.cw = cw;
  canvas.dataset.ch = ch;
  for (const data of layout().elements) styleEl(data, cw);
}

function styleEl(data, cw = Number(canvas.dataset.cw)) {
  const m = mounted.get(data.id);
  if (!m) return;
  const el = m.el;
  const ax = data.align === "left" ? "0%" : data.align === "right" ? "-100%" : "-50%";
  el.style.left = data.x + "%";
  el.style.top = data.y + "%";
  el.style.transform = `translate(${ax}, -50%)`;
  el.style.fontSize = (cw * data.size) / 100 + "px";
  el.style.opacity = data.opacity ?? 1;
  el.style.textAlign = data.align || "center";
  el.dataset.align = data.align || "center";
  for (const v of ["--fg", "--c-hours", "--c-minutes", "--c-seconds", "--c-sep", "color"]) el.style.removeProperty(v);
  if (data.color) {
    for (const v of ["--fg", "--c-hours", "--c-minutes", "--c-seconds", "--c-sep"]) el.style.setProperty(v, data.color);
    el.style.color = data.color;
  }
  el.className = "iel" + (data.font ? " font-" + data.font : "") + (data.id === selectedId && editing ? " selected" : "") + (el.classList.contains("is-empty") ? " is-empty" : "");
}

/** Idioma trocado: redesenha os textos do editor. */
export function relabel() {
  if (editing) { renderPanel(); renderToolbar(); }
}

export function update(now = new Date()) {
  for (const { el, comp } of mounted.values()) {
    comp?.update(now);
    // na edição, um elemento sem conteúdo (ex.: temperatura desligada) mostra o nome, para poder ser tocado
    el.classList.toggle("is-empty", editing && !el.textContent.trim() && !el.querySelector("svg"));
  }
}

/** Botão digital ⇄ analógico da barra: troca todos os relógios do mostrador. */
export function toggleClockType() {
  const all = clone(store.get().interactive);
  const lays = [all, all.port, editing ? draft : null].filter(Boolean);
  const first = layout().elements.find((e) => e.type === "clock");
  if (!first) return;
  const next = first.opts?.type === "analog" ? "digital" : "analog";
  for (const lay of lays) lay.elements.filter((e) => e.type === "clock").forEach((c) => { c.opts = { ...(c.opts || {}), type: next }; });
  store.set({ interactive: all });
  if (editing) { mount(true); renderPanel(); }
}

// ---------------- Edição ----------------

/** Entra no modo de edição. A tela passa a ocupar a área toda (conversão sem mudar o que se vê). */
export function startEditing(selectId = null) {
  if (editing || !root) return;
  const fw = root.clientWidth, fh = root.clientHeight;
  editOrient = orient();
  const { port: _p, auto: _a, ...src0 } = clone(stored(editOrient));
  const src = src0;
  const ar = src.ar || fw / fh;
  let cw, ch;
  if (fw / fh > ar) { ch = fh; cw = fh * ar; } else { cw = fw; ch = fw / ar; }
  const ox = (fw - cw) / 2, oy = (fh - ch) / 2;
  src.elements.forEach((e) => {
    e.x = ((ox + (e.x / 100) * cw) / fw) * 100;
    e.y = ((oy + (e.y / 100) * ch) / fh) * 100;
    e.size = (e.size * cw) / fw;
  });
  src.ar = fw / fh;
  draft = src;
  editing = true;
  selectedId = null;
  resetArmed = false;
  document.documentElement.classList.add("editing");
  document.documentElement.classList.toggle("edit-bottom", editOrient === "port");
  document.getElementById("edit-ui").hidden = false;
  renderPanel();
  renderToolbar();
  mount(true);
  if (selectId && findEl(selectId)) select(selectId);
}

function finish(save) {
  if (!editing) return;
  const result = draft;
  editing = false;
  draft = null;
  selectedId = null;
  document.documentElement.classList.remove("editing", "edit-bottom");
  document.getElementById("edit-ui").hidden = true;
  closeAddSheet();
  hideGuides();
  if (save) {
    result.elements.forEach((e) => { e.x = round(e.x); e.y = round(e.y); e.size = round(e.size); });
    result.ar = round(result.ar * 1000) / 1000;
    const it = store.get().interactive;
    store.set({ interactive: editOrient === "port" ? { ...it, port: result } : { ...result, port: it.port?.auto ? null : it.port ?? null } });
  }
  mount(true);
  onExit?.();
}
const round = (n) => Math.round(n * 100) / 100;

function select(id) {
  selectedId = id;
  markSelected();
  renderPanel();
}

function markSelected() {
  for (const [id, { el }] of mounted) {
    el.classList.toggle("selected", editing && id === selectedId);
    el.tabIndex = editing ? 0 : -1;
  }
}

function changed(id, patch, { remount = false, panel = false } = {}) {
  const data = draft.elements.find((e) => e.id === id);
  if (!data) return;
  Object.assign(data, patch);
  if (remount) mount(true);
  else styleEl(data);
  if (panel) renderPanel();
}

function changeOpts(id, patch, opts = {}) {
  const data = draft.elements.find((e) => e.id === id);
  if (!data) return;
  data.opts = { ...(data.opts || {}), ...patch };
  changed(id, {}, { remount: true, ...opts });
}

function addElement(type) {
  if (draft.elements.length >= MAX_ELEMENTS) return;
  const isClock = type === "clock";
  const data = {
    id: uid(), type, x: 50, y: 50,
    size: isClock ? 16 : 3.6, align: "center",
    opacity: isClock ? 1 : 0.7, color: null, font: isClock ? null : "rounded",
    opts: isClock ? { ...store.get().clock } : (TYPE_DEFAULTS[type]?.() || {}),
  };
  if (type === "temperature") data.opts = { condition: true, icon: true };
  draft.elements.push(data);
  mount(true);
  select(data.id);
}

function removeSelected() {
  if (!selectedId) return;
  draft.elements = draft.elements.filter((e) => e.id !== selectedId);
  selectedId = null;
  mount(true);
  renderPanel();
}

function duplicateSelected() {
  const src = findEl(selectedId);
  if (!src || draft.elements.length >= MAX_ELEMENTS) return;
  const copy = { ...clone(src), id: uid(), x: clamp(src.x + 4, 0, 100), y: clamp(src.y + 6, 0, 100) };
  draft.elements.push(copy);
  mount(true);
  select(copy.id);
}

function bringToFront() {
  const i = draft.elements.findIndex((e) => e.id === selectedId);
  if (i < 0) return;
  draft.elements.push(draft.elements.splice(i, 1)[0]);
  mount(true);
}

function resetLayout() {
  const fresh = editOrient === "port" ? store.defaultPortrait(store.get().clock) : store.defaultInteractive(store.get().clock);
  delete fresh.port;
  fresh.ar = root.clientWidth / root.clientHeight;
  draft = fresh;
  selectedId = null;
  mount(true);
  renderPanel();
}

// ---------------- Arrastar, ímã e pinça ----------------

function snapValue(v, targets) {
  let best = null;
  for (const tv of targets) if (Math.abs(v - tv) <= SNAP && (best === null || Math.abs(v - tv) < Math.abs(v - best))) best = tv;
  return best;
}

function snapTargets(id, data) {
  const others = draft.elements.filter((e) => e.id !== id);
  const xs = [...others.filter((e) => e.align === data.align).map((e) => e.x)];
  if (data.align === "center") xs.push(50);
  if (data.align === "left") xs.push(MARGIN);
  if (data.align === "right") xs.push(100 - MARGIN);
  const ys = [50, ...others.map((e) => e.y)];
  return { xs, ys };
}

/** Não deixa o elemento sair pelas laterais (mede a largura atual dele). */
function keepInside(id, x) {
  const m = mounted.get(id), data = findEl(id);
  if (!m || !canvas.offsetWidth) return x;
  const w = Math.min(100, (m.el.offsetWidth / canvas.offsetWidth) * 100);
  const lo = data.align === "left" ? 0 : data.align === "right" ? w : w / 2;
  const hi = data.align === "left" ? 100 - w : data.align === "right" ? 100 : 100 - w / 2;
  return lo > hi ? 50 : clamp(x, lo, hi);
}

function showGuides(x, y) {
  guideV.hidden = x === null;
  guideH.hidden = y === null;
  if (x !== null) guideV.style.left = x + "%";
  if (y !== null) guideH.style.top = y + "%";
}
function hideGuides() { if (guideV) { guideV.hidden = true; guideH.hidden = true; } }

function bindEditing() {
  const pointers = new Map();     // pointerId → {x, y}
  let drag = null;
  let pinch = null;

  root.addEventListener("pointerdown", (e) => {
    if (!editing) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { root.setPointerCapture(e.pointerId); } catch { /* ok */ }

    if (pointers.size === 2 && selectedId) {
      // pinça: muda o tamanho do elemento selecionado
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: findEl(selectedId).size };
      drag = null;
      return;
    }
    const target = e.target.closest(".iel");
    if (!target) { select(null); return; }
    const data = findEl(target.dataset.id);
    if (data.id !== selectedId) select(data.id);
    drag = { id: data.id, sx: e.clientX, sy: e.clientY, x0: data.x, y0: data.y, moved: false };
  });

  root.addEventListener("pointermove", (e) => {
    if (!editing || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      changed(selectedId, { size: clamp(pinch.s0 * (d / pinch.d0), 1, 45) });
      syncSizeInput();
      return;
    }
    if (!drag) return;
    const { dx, dy } = mapDelta(e.clientX - drag.sx, e.clientY - drag.sy);
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const data = findEl(drag.id);
    let x = clamp(drag.x0 + (dx / (canvas.offsetWidth * scale)) * 100, 0, 100);
    let y = clamp(drag.y0 + (dy / (canvas.offsetHeight * scale)) * 100, 0, 100);
    const { xs, ys } = snapTargets(drag.id, data);
    const sx = snapValue(x, xs), sy = snapValue(y, ys);
    if (sx !== null) x = sx;
    if (sy !== null) y = sy;
    showGuides(sx, sy);
    changed(drag.id, { x: keepInside(drag.id, x), y });
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) { drag = null; hideGuides(); }
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);

  // teclado: setas movem, Delete remove, Esc tira a seleção
  document.addEventListener("keydown", (e) => {
    if (!editing || !selectedId || e.target.closest?.("input, textarea, select")) return;
    const step = e.shiftKey ? 2 : 0.5;
    const data = findEl(selectedId);
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      changed(selectedId, { x: clamp(data.x + moves[e.key][0], 0, 100), y: clamp(data.y + moves[e.key][1], 0, 100) });
    } else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
    else if (e.key === "Escape") select(null);
  });
  root.addEventListener("focusin", (e) => {
    const el = e.target.closest?.(".iel");
    if (editing && el && el.dataset.id !== selectedId) select(el.dataset.id);
  });
}

// ---------------- Barra de ferramentas e painel ----------------

let toolbar, panel, addSheet;

function bindUi() {
  const ui = document.getElementById("edit-ui");
  toolbar = ui.querySelector(".edit-toolbar");
  panel = ui.querySelector(".edit-panel");
  addSheet = ui.querySelector(".edit-add");

  ui.addEventListener("click", (e) => { if (handleSelectTap(e)) e.stopPropagation(); }, true);
  ui.addEventListener("click", onClick);
  ui.addEventListener("input", (e) => onField(e.target, true));
  ui.addEventListener("change", (e) => onField(e.target, false));
  ui.addEventListener("mousedown", (e) => { if (e.target.closest(".chip")) e.preventDefault(); });
}

function renderToolbar() {
  toolbar.innerHTML = `
    <button type="button" class="tb-btn" data-ed="add">${ICON_PLUS}<span>${t("edit.add")}</span></button>
    <button type="button" class="tb-btn ${resetArmed ? "danger" : ""}" data-ed="reset">${ICON_RESET}<span>${resetArmed ? t("edit.resetConfirm") : t("edit.reset")}</span></button>
    <button type="button" class="tb-btn" data-ed="cancel"><span>${t("edit.cancel")}</span></button>
    <button type="button" class="tb-btn primary" data-ed="done">${ICON_CHECK}<span>${t("edit.done")}</span></button>`;
}

function label(type) {
  return type === "clock" ? t("comp.clock") : t("comp." + type);
}

function selectRow(field, labelText, options, value) {
  return `
    <div class="ep-row"><span class="ep-label">${labelText}</span>
      <select data-f="${field}">${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
    </div>`;
}
function toggleRow(field, labelText, on) {
  return `<label class="ep-row"><span class="ep-label">${labelText}</span><span class="switch"><input type="checkbox" data-f="${field}" ${on ? "checked" : ""}><span></span></span></label>`;
}
function rangeRow(field, labelText, value, min, max, step, shown) {
  return `<div class="ep-row"><span class="ep-label">${labelText} <span class="ep-val" data-val="${field}">${shown}</span></span>
    <input type="range" class="range" data-f="${field}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}
function textRow(field, labelText, value, placeholder = "") {
  return `<div class="ep-row ep-stack"><span class="ep-label">${labelText}</span>
    <input type="text" class="field-input" id="ep-${field.replace(/\W/g, "")}" data-f="${field}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></div>`;
}

function renderPanel() {
  if (!panel) return;
  const data = selectedId && findEl(selectedId);
  if (!editing || !data) {
    panel.innerHTML = editing ? `<div class="ep-empty">${t("edit.hint")}</div>` : "";
    return;
  }
  const o = data.opts || {};
  let html = `
    <div class="ep-head">
      <span class="ep-title">${esc(label(data.type))}</span>
      <span class="ep-actions">
        <button type="button" class="ep-icon" data-ed="front" aria-label="${esc(t("edit.front"))}" title="${esc(t("edit.front"))}">${ICON_FRONT}</button>
        <button type="button" class="ep-icon" data-ed="duplicate" aria-label="${esc(t("edit.duplicate"))}" title="${esc(t("edit.duplicate"))}">${ICON_COPY}</button>
        <button type="button" class="ep-icon danger" data-ed="delete" aria-label="${esc(t("edit.delete"))}" title="${esc(t("edit.delete"))}">${ICON_TRASH}</button>
      </span>
    </div>
    <div class="ep-body">`;

  html += `<div class="ep-row ep-size"><span class="ep-label">${t("edit.size")}</span>
      <span class="ep-stepper">
        <button type="button" class="ep-icon" data-ed="smaller" aria-label="${esc(t("edit.smaller"))}">−</button>
        <input type="range" class="range" data-f="size" min="1" max="45" step="0.2" value="${data.size}">
        <button type="button" class="ep-icon" data-ed="bigger" aria-label="${esc(t("edit.bigger"))}">+</button>
      </span></div>`;
  html += `<div class="ep-row ep-colors"><span class="ep-label">${t("edit.color")}</span><span class="ep-swatches">
      ${COLORS.map((c) => `<button type="button" class="ep-swatch ${c === data.color ? "on" : ""} ${c ? "" : "auto"}" data-ed="color" data-value="${c || ""}" style="${c ? `background:${c}` : ""}" aria-label="${c ? c : esc(t("edit.colorAuto"))}">${c ? "" : "A"}</button>`).join("")}
      <input type="color" data-f="color" value="${data.color || "#33ff66"}" aria-label="${esc(t("edit.colorCustom"))}">
    </span></div>`;
  html += rangeRow("opacity", t("edit.opacity"), data.opacity ?? 1, 0.15, 1, 0.05, Math.round((data.opacity ?? 1) * 100) + "%");
  html += `<div class="ep-row"><span class="ep-label">${t("edit.align")}</span><span class="segmented ep-seg">
      ${["left", "center", "right"].map((a) => `<button type="button" data-ed="align" data-value="${a}" aria-pressed="${(data.align || "center") === a}">${t("edit.align_" + a)}</button>`).join("")}
    </span></div>`;

  if (data.type === "clock") {
    const isAnalog = o.type === "analog";
    html += `<div class="ep-row"><span class="ep-label">${t("center.type")}</span><span class="segmented ep-seg">
        <button type="button" data-ed="clocktype" data-value="digital" aria-pressed="${!isAnalog}">${t("center.digital")}</button>
        <button type="button" data-ed="clocktype" data-value="analog" aria-pressed="${isAnalog}">${t("center.analog")}</button>
      </span></div>`;
    if (!isAnalog) {
      html += selectRow("opts.font", t("center.font"), CLOCK_FONTS.map((f) => ({ value: f, label: t("font." + f) })), o.font || "rounded");
      html += toggleRow("opts.flip", t("clock.flip"), o.flip);
      html += toggleRow("opts.seconds", t("center.seconds"), o.seconds !== false);
      html += toggleRow("opts.hour12", t("center.hour12"), o.hour12);
      html += toggleRow("opts.blink", t("center.blink"), o.blink);
    } else {
      html += toggleRow("opts.analogHourNumbers", t("center.analogHourNumbers"), o.analogHourNumbers);
      html += toggleRow("opts.analogMinuteNumbers", t("center.analogMinuteNumbers"), o.analogMinuteNumbers);
      html += toggleRow("opts.analogMinuteTicks", t("center.analogMinuteTicks"), o.analogMinuteTicks);
      html += toggleRow("opts.analogSeconds", t("center.analogSeconds"), o.analogSeconds !== false);
      if (o.analogSeconds !== false) html += toggleRow("opts.analogSmooth", t("center.analogSmooth"), o.analogSmooth);
    }
  } else {
    html += selectRow("font", t("center.font"), FONTS.map((f) => ({ value: f, label: t("font." + f) })), data.font || "rounded");
    switch (data.type) {
      case "timezone":
        html += selectRow("opts.zone", t("tz.zone"), ZONES.map((z) => ({ value: z, label: zoneCity(z) })), o.zone);
        html += textRow("opts.label", t("tz.label"), o.label || "", t("tz.labelPlaceholder"));
        break;
      case "progress":
        html += selectRow("opts.mode", t("progress.mode"), ["day", "week", "month", "year"].map((m) => ({ value: m, label: t("progress." + m) })), o.mode);
        break;
      case "moon":
        html += selectRow("opts.hemisphere", t("moon.hemisphere"), ["auto", "north", "south"].map((h) => ({ value: h, label: t("moon." + h) })), o.hemisphere || "auto");
        html += toggleRow("opts.showName", t("moon.showName"), o.showName !== false);
        break;
      case "countdown":
        html += `<div class="ep-row"><span class="ep-label">${t("countdown.date")}</span><input type="date" data-f="opts.date" value="${esc(o.date || "")}"></div>`;
        html += textRow("opts.label", t("countdown.label"), o.label || "", t("countdown.labelPlaceholder"));
        break;
      case "text":
        html += textRow("opts.text", t("text.template"), o.text || "", t("text.placeholder"));
        html += `<div class="ep-row ep-stack"><span class="ep-label">${t("text.tokens")}</span>
          <div class="chips">${TOKENS.map((tk) => `<button type="button" class="chip" data-ed="token" data-value="{${tk}}">{${tk}}</button>`).join("")}</div>
          <span class="preview">${t("text.preview")} <b data-preview>${esc(expand(o.text || ""))}</b></span></div>`;
        break;
      case "temperature":
        if (!store.get().tempEnabled) html += `<div class="ep-row"><span class="row-hint warn">${t("comp.tempOff")}</span></div>`;
        html += toggleRow("opts.icon", t("temp.icon"), o.icon !== false);
        html += toggleRow("opts.condition", t("temp.condition"), o.condition !== false);
        for (const k of WEATHER_EXTRAS) html += toggleRow("opts." + k, t("wxopt." + k), !!o[k]);
        break;
      case "sun":
        if (typeof store.get().location?.lat !== "number") html += `<div class="ep-row"><span class="row-hint warn">${t("comp.needsLocation")}</span></div>`;
        break;
    }
  }
  html += "</div>";
  panel.innerHTML = html;
  enhanceSelects(panel);
}

function syncSizeInput() {
  const r = panel?.querySelector('input[data-f="size"]');
  const data = selectedId && findEl(selectedId);
  if (r && data) r.value = data.size;
}

function openAddSheet() {
  addSheet.hidden = false;
  addSheet.innerHTML = `
    <div class="ea-card" role="dialog" aria-label="${esc(t("edit.add"))}">
      <div class="ea-title">${t("edit.addTitle")}</div>
      <div class="ea-grid">
        ${ELEMENT_TYPES.map((ty) => `<button type="button" data-ed="add-type" data-value="${ty}">${esc(label(ty))}</button>`).join("")}
      </div>
      <button type="button" class="tb-btn" data-ed="add-close">${t("edit.cancel")}</button>
    </div>`;
  addSheet.querySelector("button")?.focus();
}
function closeAddSheet() { if (addSheet) { addSheet.hidden = true; addSheet.innerHTML = ""; } }

function onClick(e) {
  const b = e.target.closest("[data-ed]");
  if (!b) {
    if (e.target === addSheet) closeAddSheet();
    return;
  }
  const v = b.dataset.value;
  switch (b.dataset.ed) {
    case "add": openAddSheet(); break;
    case "add-close": closeAddSheet(); break;
    case "add-type": closeAddSheet(); addElement(v); break;
    case "reset":
      if (!resetArmed) { resetArmed = true; renderToolbar(); setTimeout(() => { resetArmed = false; if (editing) renderToolbar(); }, 3500); }
      else { resetArmed = false; resetLayout(); renderToolbar(); }
      break;
    case "cancel": finish(false); break;
    case "done": finish(true); break;
    case "delete": removeSelected(); break;
    case "duplicate": duplicateSelected(); break;
    case "front": bringToFront(); break;
    case "smaller": case "bigger": {
      const d = findEl(selectedId);
      const f = b.dataset.ed === "bigger" ? 1.1 : 1 / 1.1;
      changed(selectedId, { size: clamp(d.size * f, 1, 45) });
      syncSizeInput();
      break;
    }
    case "color": changed(selectedId, { color: v || null }, { panel: true }); break;
    case "align": changed(selectedId, { align: v }, { panel: true }); break;
    case "clocktype": changeOpts(selectedId, { type: v }, { panel: true }); break;
    case "token": {
      const input = panel.querySelector('input[data-f="opts.text"]');
      if (!input) break;
      const s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, s) + v + input.value.slice(en);
      input.focus();
      try { input.setSelectionRange(s + v.length, s + v.length); } catch { /* ok */ }
      onField(input, true);
      break;
    }
  }
}

/** Campo do painel alterado. live = ainda digitando/arrastando. */
function onField(el, live) {
  const f = el.dataset.f;
  if (!f || !selectedId) return;
  const isLive = ["range", "text", "color"].includes(el.type);
  if (live && !isLive) return;
  if (!live && isLive && el.type !== "color") return;   // já aplicado
  let value = el.type === "checkbox" ? el.checked : el.value;
  if (el.type === "range") value = Number(value);
  if (f.startsWith("opts.")) {
    const key = f.slice(5);
    if (el.type === "text") {
      // texto: aplica sem redesenhar o painel (mantém o cursor)
      const data = findEl(selectedId);
      data.opts = { ...(data.opts || {}), [key]: value };
      mount(true);
      const prev = panel.querySelector("[data-preview]");
      if (prev) prev.textContent = expand(value);
      return;
    }
    changeOpts(selectedId, { [key]: value }, { panel: !live });
    return;
  }
  if (f === "opacity") {
    const out = panel.querySelector('[data-val="opacity"]');
    if (out) out.textContent = Math.round(value * 100) + "%";
  }
  if (f === "color") { changed(selectedId, { color: value }, { panel: !live }); return; }
  changed(selectedId, { [f]: value }, { panel: !live && f === "font" });
  if (f === "font") mount(true);
}

// ---------------- Ícones ----------------
const svg = (d, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_PLUS = svg('<path d="M12 5v14M5 12h14"/>');
const ICON_RESET = svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>');
const ICON_CHECK = svg('<path d="M5 12.5l4.5 4.5L19 7"/>');
const ICON_TRASH = svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 17);
const ICON_COPY = svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 17);
const ICON_FRONT = svg('<rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" stroke="none"/><path d="M15 5V4H4v11h1"/>', 17);
