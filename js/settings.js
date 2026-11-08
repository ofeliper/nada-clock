// Painel de configurações.
import * as store from "./store.js";
import * as weather from "./weather.js";
import { t, LANGUAGES, getLanguage, formatShortTime, formatDate } from "./i18n.js";
import { THEMES, THEME_ORDER, resolveTheme } from "./themes.js";
import { SLOT_TYPES, CENTER_TYPES, ZONES, zoneCity } from "./components.js";
import { TOKENS, expand } from "./tokens.js";
import { SOUNDS, play as playSound, unlock as unlockSound } from "./sound.js";
import { enhanceSelects, handleSelectTap } from "./picker.js";
import * as update from "./update.js";
import * as timers from "./timer.js";

export const VERSION = "0.4.0";

const DATE_FORMATS = ["auto", "dmy", "mdy", "ymd", "short", "long"];
const SEPARATORS = ["/", "-", "."];
const FONTS = ["thin", "regular", "bold", "mono", "rounded"];
const GRID = ["TL", "T", "TR", "L", "C", "R", "BL", "B", "BR"];

let root, body, onCloseCb, getWakeLockState;
let asking = false;           // mostrando o aviso "precisamos da localização"
let selectedSlot = "B";       // posição selecionada no editor do Customizado
let resetArmed = false;       // 1º toque em "Restaurar padrão"
let resetTimer;
let suppressRender = false;   // evita redesenhar o painel enquanto a pessoa digita
let updateStatus = "";        // "", checking, latest, updating, unsupported, error

export function initSettings({ onClose, wakeLockState }) {
  root = document.getElementById("settings");
  body = document.getElementById("settings-body");
  onCloseCb = onClose;
  getWakeLockState = wakeLockState;

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  body.addEventListener("change", onChange);
  body.addEventListener("input", onInput);
  // selects: abrem o seletor próprio (que gira junto com o app)
  body.addEventListener("click", (e) => { if (handleSelectTap(e)) e.stopPropagation(); }, true);
  body.addEventListener("click", onClick);
  // os botões de placeholder não tiram o foco do campo de texto (mantém o cursor)
  body.addEventListener("mousedown", (e) => { if (e.target.closest(".chip")) e.preventDefault(); });

  store.subscribe(() => { if (isOpen() && !suppressRender) render(); });
  weather.subscribe(() => { if (isOpen()) render(); });
}

export function isOpen() {
  return root && !root.hidden;
}

export function open() {
  asking = false;
  resetArmed = false;
  updateStatus = "";
  root.hidden = false;
  render();
}

export function close() {
  root.hidden = true;
  asking = false;
  onCloseCb?.();
}

export function refresh() {
  if (isOpen()) render();
}

// ---------------- Render ----------------

function render() {
  const s = store.get();
  const scroll = body.scrollTop;
  const lang = getLanguage();
  const custom = s.face === "custom";

  body.innerHTML = `
    ${group(t("group.display"), `
      <div class="segmented" role="group" aria-label="${t("face.label")}">
        <button type="button" data-action="face" data-value="minimal" aria-pressed="${!custom}">${t("face.minimal")}</button>
        <button type="button" data-action="face" data-value="custom" aria-pressed="${custom}">${t("face.custom")}</button>
      </div>
      <div class="swatches" role="group" aria-label="${t("theme.label")}">
        ${THEME_ORDER.map((th) => swatch(th, s.theme === th)).join("")}
      </div>
      ${s.theme === "system" ? `<div class="row"><span class="row-label"><span class="row-hint">${t("theme.systemHint")}</span></span></div>` : ""}
      ${switchRow(null, t("rotate.force"), s.orientation === "landscape", t("rotate.hint"), 'data-orientation')}
      ${s.orientation === "landscape" ? selectRow("rotateDir", t("rotate.side"), [
        { value: "left", label: t("rotate.left") }, { value: "right", label: t("rotate.right") },
      ], s.rotateDir) : ""}
    `)}

    ${custom ? centerSection(s) + slotsSection(s) + colorsSection(s) : ""}

    ${group(t("group.info"), `
      ${!custom ? switchRow("showWeekday", t("info.weekday"), s.showWeekday) : ""}
      ${!custom ? switchRow("showDate", t("info.date"), s.showDate) : ""}
      ${custom || s.showDate ? dateFormatRows(s, lang) : ""}
    `)}

    ${group(t("group.sounds"), soundsSection(s))}

    ${group(t("group.temperature"), temperatureSection(s, lang))}

    ${group(t("group.night"), `
      ${switchRow("nightEnabled", t("night.enabled"), s.nightEnabled, t("night.hint"))}
      ${s.nightEnabled ? `
        ${timeRow("nightStart", t("night.start"), s.nightStart)}
        ${timeRow("nightEnd", t("night.end"), s.nightEnd)}
      ` : ""}
    `)}

    ${group(t("group.general"), `
      ${selectRow("language", t("general.language"), [
        { value: "auto", label: t("general.languageAuto") },
        ...Object.entries(LANGUAGES).map(([k, v]) => ({ value: k, label: v.name })),
      ], s.language)}
      ${selectRow("uiTheme", t("general.uiTheme"), [
        { value: "auto", label: t("general.uiAuto") },
        { value: "dark", label: t("general.uiDark") },
        { value: "light", label: t("general.uiLight") },
      ], s.uiTheme)}
      ${switchRow("burnIn", t("general.burnin"), s.burnIn, t("general.burninHint"))}
      <div class="row">
        <span class="row-label">${t("general.wakeLock")}
          <span class="row-hint ${getWakeLockState() === "on" ? "" : "warn"}">${wakeLockText()}</span>
        </span>
      </div>
      <div class="row">
        <span class="row-label">${t("update.version", { v: VERSION })}
          ${updateHint()}
        </span>
        <button type="button" class="btn" data-action="update-check" ${updateStatus === "checking" || updateStatus === "updating" ? "disabled" : ""}>${t("update.check")}</button>
      </div>
      <div class="row">
        <span class="row-label">
          <button type="button" class="btn danger ${resetArmed ? "confirm" : ""}" data-action="reset">${resetArmed ? t("general.resetConfirm") : t("general.reset")}</button>
          <span class="row-hint">${t("general.resetHint")}</span>
        </span>
      </div>
    `)}

    <div class="about">
      <b>NADA CLOCK</b> · v${VERSION}<br>
      ${t("about.tagline")}<br>
      ${t("about.gestures")}
    </div>
  `;
  enhanceSelects(body);
  body.scrollTop = scroll;
}

function swatch(th, pressed) {
  const isSystem = th === "system";
  const style = isSystem ? "" : `style="color:${THEMES[th].fg};background:${THEMES[th].bg}"`;
  return `
    <button type="button" class="swatch" data-action="theme" data-value="${th}" aria-pressed="${pressed}">
      <span class="swatch-chip ${isSystem ? "chip-system" : ""}" ${style}>12:34</span>
      ${t("theme." + th)}
    </button>`;
}

function dateFormatRows(s, lang) {
  const sample = new Date(2026, 10, 8);
  return `
    ${selectRow("dateFormat", t("info.dateFormat"), DATE_FORMATS.map((f) => ({
      value: f,
      label: f === "auto"
        ? `${t("dateFormat.auto")} — ${formatDate(sample, "auto", s.dateSeparator)}`
        : `${t("dateFormat." + f)}${["short", "long"].includes(f) ? " — " + formatDate(sample, f) : ""}`,
    })), s.dateFormat)}
    ${["auto", "dmy", "mdy"].includes(s.dateFormat) ? selectRow("dateSeparator", t("info.separator"),
      SEPARATORS.map((x) => ({ value: x, label: x })), s.dateSeparator) : ""}`;
}

// ---------- Customizado: centro ----------
function centerSection(s) {
  const c = s.custom.center;
  let rows = selectRow(null, t("center.type"), CENTER_TYPES.map((x) => ({ value: x, label: t("center." + x) })), c.type, 'data-center="type"');
  if (c.type === "digital") {
    rows += switchRow(null, t("center.hour12"), c.hour12, "", 'data-center="hour12"');
    rows += switchRow(null, t("center.seconds"), c.seconds, "", 'data-center="seconds"');
    rows += switchRow(null, t("center.blink"), c.blink, "", 'data-center="blink"');
    rows += selectRow(null, t("center.font"), FONTS.map((f) => ({ value: f, label: t("font." + f) })), c.font, 'data-center="font"');
  } else if (c.type === "analog") {
    rows += switchRow(null, t("center.analogHourNumbers"), c.analogHourNumbers, "", 'data-center="analogHourNumbers"');
    rows += switchRow(null, t("center.analogMinuteNumbers"), c.analogMinuteNumbers, "", 'data-center="analogMinuteNumbers"');
    rows += switchRow(null, t("center.analogMinuteTicks"), c.analogMinuteTicks, "", 'data-center="analogMinuteTicks"');
    rows += switchRow(null, t("center.analogSeconds"), c.analogSeconds, "", 'data-center="analogSeconds"');
    if (c.analogSeconds) rows += switchRow(null, t("center.analogSmooth"), c.analogSmooth, t("center.analogSmoothHint"), 'data-center="analogSmooth"');
  } else if (c.type === "text") {
    rows += textEditor("center-text", c.text, 'data-center="text"');
  }
  return group(t("group.center"), rows);
}

// ---------- Customizado: posições ----------
function slotLabel(id, s) {
  if (id === "C") return t("comp." + (s.custom.center.type === "text" ? "text" : s.custom.center.type));
  const type = s.custom.slots[id]?.type || "empty";
  return type === "empty" ? "—" : t("comp." + type);
}

function slotsSection(s) {
  if (selectedSlot === "C") selectedSlot = "B";
  const grid = `
    <div class="slot-grid" role="group" aria-label="${t("group.slots")}">
      ${GRID.map((id) => {
        const filled = id === "C" || (s.custom.slots[id] && s.custom.slots[id].type !== "empty");
        const disabled = id === "C";
        return `<button type="button" data-action="slot" data-value="${id}" ${disabled ? "disabled" : ""}
          class="${filled ? "filled" : ""}" aria-pressed="${id === selectedSlot}">${slotLabel(id, s)}</button>`;
      }).join("")}
    </div>`;

  const cfg = s.custom.slots[selectedSlot] || { type: "empty" };
  let rows = selectRow(null, t("slots.component"), SLOT_TYPES.map((x) => ({ value: x, label: t("comp." + x) })), cfg.type, "data-slottype");

  switch (cfg.type) {
    case "timezone":
      rows += selectRow(null, t("tz.zone"), ZONES.map((z) => ({ value: z, label: zoneCity(z) })), cfg.zone, 'data-slotfield="zone"');
      rows += inputRow(t("tz.label"), cfg.label || "", t("tz.labelPlaceholder"), 'data-slotfield="label"');
      break;
    case "progress":
      rows += selectRow(null, t("progress.mode"), ["day", "week", "month", "year"].map((m) => ({ value: m, label: t("progress." + m) })), cfg.mode, 'data-slotfield="mode"');
      break;
    case "moon":
      rows += selectRow(null, t("moon.hemisphere"), ["auto", "north", "south"].map((h) => ({ value: h, label: t("moon." + h) })), cfg.hemisphere || "auto", 'data-slotfield="hemisphere"');
      rows += switchRow(null, t("moon.showName"), cfg.showName !== false, "", 'data-slotfield="showName"');
      break;
    case "countdown":
      rows += `<div class="row"><span class="row-label">${t("countdown.date")}</span><input type="date" data-slotfield="date" value="${esc(cfg.date || "")}"></div>`;
      rows += inputRow(t("countdown.label"), cfg.label || "", t("countdown.labelPlaceholder"), 'data-slotfield="label"');
      break;
    case "text":
      rows += textEditor("slot-text", cfg.text || "", 'data-slotfield="text"');
      break;
    case "temperature":
      if (!s.tempEnabled) rows += `<div class="row"><span class="row-label"><span class="row-hint warn">${t("comp.tempOff")}</span></span></div>`;
      break;
  }

  return group(t("group.slots"), `
    <div class="row"><span class="row-label"><span class="row-hint">${t("slots.hint")}</span></span></div>
    ${grid}
    ${rows}`);
}

function textEditor(id, value, attr) {
  return `
    <div class="row row-stack">
      <span class="row-label">${t("text.template")}</span>
      <input type="text" class="field-input" id="${id}" ${attr} value="${esc(value)}" placeholder="${esc(t("text.placeholder"))}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <span class="row-hint">${t("text.tokens")}</span>
      <div class="chips">${TOKENS.map((tk) => `<button type="button" class="chip" data-action="token" data-target="${id}" data-value="{${tk}}">{${tk}}</button>`).join("")}</div>
      <span class="preview" data-preview="${id}">${t("text.preview")} <b>${esc(expand(value))}</b></span>
    </div>`;
}

// ---------- Customizado: cores ----------
function colorsSection(s) {
  const col = s.custom.colors;
  let rows = switchRow(null, t("colors.enabled"), col.enabled, t("colors.hint"), 'data-color="enabled"');
  if (col.enabled) {
    for (const k of ["bg", "fg", "hours", "minutes", "seconds"]) {
      rows += `<div class="row"><span class="row-label">${t("colors." + k)}</span><input type="color" data-color="${k}" value="${esc(col[k])}"></div>`;
    }
    rows += `<div class="row"><span class="row-label"></span><button type="button" class="btn" data-action="match-main">${t("colors.matchMain")}</button></div>`;
  }
  return group(t("group.colors"), rows);
}

// ---------- Sons ----------
function soundSelect(field, value) {
  return `
    <span class="sound-pick">
      <select data-sound="${field}">
        ${SOUNDS.map((n) => `<option value="${n}" ${n === value ? "selected" : ""}>${esc(t("sound." + n))}</option>`).join("")}
      </select>
      <button type="button" class="btn icon-btn" data-action="sound-test" data-value="${field}" aria-label="${esc(t("sounds.test"))}">▶︎</button>
    </span>`;
}

function soundsSection(s) {
  const so = s.sounds;
  let rows = "";
  rows += switchRow(null, t("sounds.second"), so.second, "", 'data-sound="second"');
  if (so.second) rows += `<div class="row sub"><span class="row-label">${t("sounds.sound")}</span>${soundSelect("secondSound", so.secondSound)}</div>`;
  rows += switchRow(null, t("sounds.minute"), so.minute, "", 'data-sound="minute"');
  if (so.minute) rows += `<div class="row sub"><span class="row-label">${t("sounds.sound")}</span>${soundSelect("minuteSound", so.minuteSound)}</div>`;
  rows += switchRow(null, t("sounds.hour"), so.hour, "", 'data-sound="hour"');
  if (so.hour) {
    rows += `<div class="row sub"><span class="row-label">${t("sounds.sound")}</span>${soundSelect("hourSound", so.hourSound)}</div>`;
    rows += switchRow(null, t("sounds.hourRepeat"), so.hourRepeat, t("sounds.hourRepeatHint"), 'data-sound="hourRepeat"').replace('class="row"', 'class="row sub"');
  }
  rows += switchRow(null, t("sounds.custom"), so.custom, "", 'data-sound="custom"');
  if (so.custom) {
    rows += `<div class="row sub"><span class="row-label">
        <select data-sound="customMode">
          <option value="every" ${so.customMode === "every" ? "selected" : ""}>${esc(t("sounds.every"))}</option>
          <option value="at" ${so.customMode === "at" ? "selected" : ""}>${esc(t("sounds.at"))}</option>
        </select>
      </span>
      <input type="number" class="num-input" data-sound="customValue" min="${so.customMode === "at" ? 0 : 1}" max="${so.customMode === "at" ? 59 : 720}" inputmode="numeric" value="${esc(so.customValue)}">
      <span class="unit">${so.customMode === "at" ? t("sounds.atUnit") : t("sounds.everyUnit")}</span>
    </div>`;
    rows += `<div class="row sub"><span class="row-label">${t("sounds.sound")}</span>${soundSelect("customSound", so.customSound)}</div>`;
  }
  rows += `<div class="row"><span class="row-label">${t("sounds.timer")}</span>${soundSelect("timerSound", so.timerSound)}</div>`;
  rows += `<div class="row"><span class="row-label">${t("sounds.volume")}</span>
    <input type="range" class="range" data-sound="volume" min="0" max="1" step="0.05" value="${so.volume}"></div>`;
  rows += switchRow(null, t("sounds.muteAtNight"), so.muteAtNight, "", 'data-sound="muteAtNight"');
  rows += `<div class="row"><span class="row-label"><span class="row-hint">${t("sounds.hint")}</span></span></div>`;
  return rows;
}

// ---------- Temperatura ----------
function temperatureSection(s, lang) {
  const status = weather.getStatus();

  if (!weather.supported || status === "unsupported") {
    return `<div class="row"><span class="row-label"><span class="row-hint">${t("temp.unsupported")}</span></span></div>`;
  }

  if (status === "denied") {
    return `
      <p class="notice"><strong>${t("temp.denied")}</strong><br>${t("temp.deniedHelp")}
        <span class="notice-actions"><button type="button" class="btn primary" data-action="temp-allow">${t("temp.retry")}</button></span>
      </p>`;
  }

  if (asking) {
    return `
      ${switchRow("tempEnabled", t("temp.show"), true)}
      <p class="notice"><strong>${t("temp.askTitle")}</strong><br>${t("temp.askBody")}
        <span class="notice-actions">
          <button type="button" class="btn primary" data-action="temp-allow">${t("temp.allow")}</button>
          <button type="button" class="btn" data-action="temp-cancel">${t("temp.cancel")}</button>
        </span>
      </p>`;
  }

  const unit = s.tempUnit || LANGUAGES[lang].defaults.tempUnit;
  const cache = store.getWeatherCache();
  let hint;
  if (status === "locating" || status === "updating") hint = t("temp.updating");
  else if (cache?.updatedAt) hint = t("temp.lastUpdate", { time: formatShortTime(new Date(cache.updatedAt)) });
  else hint = t("temp.never");
  const errorHint = status === "error" ? `<span class="row-hint warn">${t("temp.error")}</span>` : "";

  return `
    ${switchRow("tempEnabled", t("temp.show"), s.tempEnabled || status === "locating")}
    ${s.tempEnabled ? `
      ${selectRow("tempUnit", t("temp.unit"), [{ value: "C", label: "°C" }, { value: "F", label: "°F" }], unit)}
      <div class="row">
        <span class="row-label"><span class="row-hint">${hint}</span>${errorHint}</span>
        <button type="button" class="btn" data-action="temp-refresh">${t("temp.refresh")}</button>
      </div>` : ""}
  `;
}

function wakeLockText() {
  const st = getWakeLockState();
  if (st === "on") return t("general.wakeLockOn");
  if (st === "unsupported") return t("general.wakeLockUnsupported");
  return t("general.wakeLockOff");
}

// ---------------- Helpers de HTML ----------------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function group(title, inner) {
  return `<div class="group"><h3 class="group-title">${title}</h3><div class="card">${inner}</div></div>`;
}

function switchRow(key, label, checked, hint, attr = "") {
  return `
    <label class="row">
      <span class="row-label">${label}${hint ? `<span class="row-hint">${hint}</span>` : ""}</span>
      <span class="switch"><input type="checkbox" ${key ? `data-key="${key}"` : ""} ${attr} ${checked ? "checked" : ""}><span></span></span>
    </label>`;
}

function selectRow(key, label, options, value, attr = "") {
  return `
    <div class="row">
      <span class="row-label">${label}</span>
      <select ${key ? `data-key="${key}"` : ""} ${attr}>
        ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select>
    </div>`;
}

/** Horário como dois seletores (hora e minuto), para usar o seletor próprio. */
function timeRow(key, label, value) {
  const [h, m] = String(value || "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!mins.includes(m)) { mins.push(m); mins.sort((a, b) => a - b); }
  const p2 = (n) => String(n).padStart(2, "0");
  const opt = (n, cur) => `<option value="${n}" ${n === cur ? "selected" : ""}>${p2(n)}</option>`;
  return `
    <div class="row">
      <span class="row-label">${label}</span>
      <span class="time-pick">
        <select data-time-key="${key}" data-part="h">${hours.map((n) => opt(n, h)).join("")}</select>
        <span>:</span>
        <select data-time-key="${key}" data-part="m">${mins.map((n) => opt(n, m)).join("")}</select>
      </span>
    </div>`;
}

function updateHint() {
  if (!updateStatus) return "";
  const warn = updateStatus === "error" || updateStatus === "unsupported";
  const force = updateStatus === "latest" || updateStatus === "error"
    ? ` <button type="button" class="link-btn" data-action="update-force">${t("update.force")}</button>` : "";
  return `<span class="row-hint ${warn ? "warn" : ""}">${t("update." + updateStatus)}${force}</span>`;
}

function inputRow(label, value, placeholder, attr) {
  return `
    <label class="row">
      <span class="row-label">${label}</span>
      <input type="text" class="field-input" ${attr} value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
    </label>`;
}

// ---------------- Eventos ----------------

const SLOT_DEFAULTS = {
  timezone: () => ({ zone: "Europe/Lisbon", label: "" }),
  progress: () => ({ mode: "day" }),
  moon: () => ({ hemisphere: "auto", showName: true }),
  countdown: () => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    const pad = (n) => String(n).padStart(2, "0");
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, label: "" };
  },
  text: () => ({ text: "{weekday}" }),
};

function readValue(el) {
  return el.type === "checkbox" ? el.checked : el.value;
}

/** Aplica um campo editado. live = true enquanto a pessoa ainda está digitando/arrastando. */
function applyField(el, live) {
  const value = readValue(el);
  const d = el.dataset;
  const isText = ["text", "color", "range", "number"].includes(el.type);
  if (live && !isText) return;          // selects/switches: só no "change"
  suppressRender = live;
  try {
    if ("sound" in d) {
      let v = value;
      if (d.sound === "volume") v = Number(value);
      if (d.sound === "customValue") v = Math.max(0, Math.min(720, Math.round(Number(value) || 0)));
      store.setSounds({ [d.sound]: v });
    } else if ("timeKey" in d) {
      const p2 = (n) => String(n).padStart(2, "0");
      const [h, m] = String(store.get()[d.timeKey] || "00:00").split(":");
      const next = d.part === "h" ? `${p2(value)}:${m}` : `${h}:${p2(value)}`;
      store.set({ [d.timeKey]: next });
    } else if ("orientation" in d) store.set({ orientation: value ? "landscape" : "auto" });
    else if ("center" in d) store.setCustom("center", { [d.center]: value });
    else if ("color" in d) {
      if (d.color === "enabled" && value) {
        // ao ligar, começa com as cores da paleta atual
        const th = THEMES[resolveTheme(store.get().theme)];
        store.setCustom("colors", { enabled: true, bg: th.bg, fg: th.fg, hours: th.fg, minutes: th.fg, seconds: th.fg });
      } else {
        store.setCustom("colors", { [d.color]: value });
      }
    } else if ("slotfield" in d) {
      const cfg = store.get().custom.slots[selectedSlot] || { type: "empty" };
      store.setSlot(selectedSlot, { ...cfg, [d.slotfield]: value });
    } else if ("slottype" in d) {
      store.setSlot(selectedSlot, { type: value, ...(SLOT_DEFAULTS[value]?.() || {}) });
    } else if (d.key) {
      store.set({ [d.key]: value });
    }
  } finally {
    suppressRender = false;
  }
  // atualiza a prévia do texto sem redesenhar o painel
  if (el.id) {
    const prev = body.querySelector(`[data-preview="${el.id}"] b`);
    if (prev) prev.textContent = expand(el.value);
  }
}

function onInput(e) {
  applyField(e.target, true);
}

async function onChange(e) {
  const el = e.target;

  if (el.dataset.key === "tempEnabled") {
    if (el.checked) {
      // Se a permissão já foi dada antes, não precisa do aviso.
      if (await permissionGranted()) { weather.enable(); }
      else { asking = true; render(); }
    } else {
      asking = false;
      weather.disable();
    }
    return;
  }

  // textos, cores e controles deslizantes já foram aplicados enquanto a pessoa mexia
  if (["text", "color", "range"].includes(el.type)) return;
  if (el.type === "number") { render(); return; }
  applyField(el, false);
}

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, value } = btn.dataset;

  if (action === "theme") store.set({ theme: value });
  if (action === "update-check") {
    updateStatus = "checking";
    render();
    update.checkNow().then((r) => { updateStatus = r; refresh(); });
  }
  if (action === "update-force") update.forceReload();
  if (action === "sound-test") {
    unlockSound();
    const so = store.get().sounds;
    playSound(so[value], so.volume);
  }
  if (action === "face") store.set({ face: value });
  if (action === "slot") { selectedSlot = value; render(); }
  if (action === "temp-allow") { asking = false; weather.enable(); render(); }
  if (action === "temp-cancel") { asking = false; render(); }
  if (action === "temp-refresh") weather.refreshNow();

  if (action === "token") {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + value + input.value.slice(end);
    const pos = start + value.length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch { /* ok */ }
    applyField(input, true);
  }

  if (action === "match-main") {
    const fg = store.get().custom.colors.fg;
    store.setCustom("colors", { hours: fg, minutes: fg, seconds: fg });
  }

  if (action === "reset") {
    if (!resetArmed) {
      resetArmed = true;
      render();
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { resetArmed = false; refresh(); }, 4000);
    } else {
      resetArmed = false;
      clearTimeout(resetTimer);
      selectedSlot = "B";
      weather.disable();
      timers.reset();
      store.reset();
    }
  }
}

async function permissionGranted() {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return p?.state === "granted";
  } catch {
    return false;
  }
}
