// Painel de configurações.
import * as store from "./store.js";
import * as weather from "./weather.js";
import * as location from "./location.js";
import { t, LANGUAGES, getLanguage, formatShortTime, formatDate } from "./i18n.js";
import { THEMES, THEME_ORDER, resolveTheme } from "./themes.js";
import { SLOT_TYPES, ZONES, zoneCity, WEATHER_EXTRAS } from "./components.js";
import { TOKENS, expand } from "./tokens.js";
import { SOUNDS, play as playSound, unlock as unlockSound } from "./sound.js";
import { enhanceSelects, handleSelectTap } from "./picker.js";
import * as update from "./update.js";
import * as timers from "./timer.js";
import * as pomodoro from "./pomodoro.js";
import * as share from "./share.js";

const REPO = "https://github.com/ofeliper/nada-clock";

export const VERSION = "0.10.0";

const DATE_FORMATS = ["auto", "dmy", "mdy", "ymd", "short", "long"];
const SEPARATORS = ["/", "-", "."];
const FONTS = ["rounded", "thin", "regular", "bold", "mono", "led"];

let root, body, onCloseCb, getWakeLockState;
let selectedSlot = "T";       // posição selecionada no editor do Customizado
let resetArmed = false;       // 1º toque em "Restaurar padrão"
let resetTimer;
let suppressRender = false;   // evita redesenhar o painel enquanto a pessoa digita
let updateStatus = "";        // "", checking, latest, updating, unsupported, error
let locAsk = false;           // aviso antes de pedir o GPS
let cityResults = null;       // resultados da busca de cidade
let cityQuery = "";
let cityError = "";
let tempNeedsLocation = false;
let dragJustEnded = false;
let sharePanel = null;        // { url, title } — painel de compartilhar preset aberto
let shareMsg = "";
let backupMsg = "";

let onEditScreen = null;
export function initSettings({ onClose, wakeLockState, editScreen }) {
  onEditScreen = editScreen;
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
  body.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "city-input") { e.preventDefault(); doCitySearch(); }
  });
  // os botões de placeholder não tiram o foco do campo de texto (mantém o cursor)
  body.addEventListener("mousedown", (e) => { if (e.target.closest(".chip")) e.preventDefault(); });
  bindDragAndDrop();

  store.subscribe(() => { if (isOpen() && !suppressRender) render(); });
  weather.subscribe(() => { if (isOpen()) render(); });
  location.subscribe(() => { if (isOpen()) render(); });
}

export function isOpen() {
  return root && !root.hidden;
}

export function open() {
  returnFocus = document.activeElement;
  resetArmed = false;
  updateStatus = "";
  locAsk = false;
  cityResults = null;
  cityError = "";
  tempNeedsLocation = false;
  sharePanel = null;
  shareMsg = "";
  backupMsg = "";
  root.hidden = false;
  setTimeout(() => root.querySelector(".settings-close")?.focus({ preventScroll: true }), 30);
  render();
}

let returnFocus = null;
export function close() {
  root.hidden = true;
  onCloseCb?.();
  try { returnFocus?.focus?.({ preventScroll: true }); } catch { /* ok */ }
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
  const inter = s.face === "interactive";
  const minimal = !custom && !inter;

  body.innerHTML = `
    ${group(t("group.display"), `
      <div class="segmented grid2" role="group" aria-label="${t("face.label")}">
        ${store.MODES.map((m) => `<button type="button" data-action="mode" data-value="${m}" aria-pressed="${store.currentMode(s) === m}">${t("mode." + m)}</button>`).join("")}
      </div>
      <div class="row"><span class="row-label"><span class="row-hint">${t(custom ? "face.customHint" : inter ? "face.interactiveHint" : "face.minimalHint")}</span><span class="row-hint">${t("clock.swapHint")}</span><span class="row-hint">${t("radial.hint")}</span></span>
        ${inter ? `<button type="button" class="btn" data-action="edit-screen">${t("edit.open")}</button>` : ""}</div>
      <div class="swatches" role="group" aria-label="${t("theme.label")}">
        ${THEME_ORDER.map((th) => swatch(th, s.theme === th)).join("")}
      </div>
      ${s.theme === "system" ? `<div class="row"><span class="row-label"><span class="row-hint">${t("theme.systemHint")}</span></span></div>` : ""}
      ${switchRow(null, t("rotate.force"), s.orientation === "landscape", t("rotate.hint"), 'data-orientation')}
      ${s.orientation === "landscape" ? selectRow("rotateDir", t("rotate.side"), [
        { value: "left", label: t("rotate.left") }, { value: "right", label: t("rotate.right") },
      ], s.rotateDir) : ""}
    `)}

    ${inter ? "" : group(t("group.clock"), clockSection(s, custom))}

    ${custom ? slotsSection(s) + presetsSection(s) + colorsSection(s) : ""}

    ${group(t("group.info"), `
      ${minimal ? switchRow("showWeekday", t("info.weekday"), s.showWeekday) : ""}
      ${minimal ? switchRow("showDate", t("info.date"), s.showDate) : ""}
      ${minimal ? selectRow("infoPosition", t("info.position"), [
        { value: "top", label: t("info.above") }, { value: "bottom", label: t("info.below") },
      ], s.infoPosition) : ""}
      ${dateFormatRows(s)}
    `)}

    ${group(t("group.location"), locationSection(s))}

    ${group(t("group.temperature"), temperatureSection(s, lang))}

    ${group(t("group.pomodoro"), pomodoroSection(s))}

    ${group(t("group.sounds"), soundsSection(s))}

    ${group(t("group.night"), `
      ${switchRow("nightEnabled", t("night.enabled"), s.nightEnabled, t("night.hint"))}
      ${s.nightEnabled ? `
        ${timeRow("nightStart", t("night.start"), s.nightStart)}
        ${timeRow("nightEnd", t("night.end"), s.nightEnd)}
        ${switchRow("nightColor", t("night.color"), s.nightColor !== false, t("night.colorHint"))}
        <div class="row"><span class="row-label">${t("night.brightness")}<span class="row-hint">${Math.round((s.nightBrightness ?? 1) * 100)}%</span></span>
          <input type="range" class="range" data-key="nightBrightness" min="0.05" max="1" step="0.05" value="${s.nightBrightness ?? 1}"></div>
      ` : ""}
    `)}

    ${group(t("group.backup"), backupSection())}

    ${group(t("group.about"), `
      <a class="row link-row" href="${aboutHref()}" target="_blank" rel="noopener">${t("about.page")}<span aria-hidden="true">›</span></a>
      <a class="row link-row" href="${REPO}/issues/new/choose" target="_blank" rel="noopener">${t("about.suggest")}<span aria-hidden="true">›</span></a>
      <a class="row link-row" href="${REPO}" target="_blank" rel="noopener">${t("about.source")}<span aria-hidden="true">›</span></a>
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
      ${switchRow("mirror", t("general.mirror"), s.mirror, t("general.mirrorHint"))}
      <div class="row">
        <span class="row-label">${t("general.wakeLock")}
          <span class="row-hint ${getWakeLockState() === "off" ? "warn" : ""}">${wakeLockText()}</span>
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
  addClearButtons(body);
  body.scrollTop = scroll;
}

/** Botão "✕" no fim de cada campo de texto, para limpar com um toque. */
function addClearButtons(container) {
  container.querySelectorAll('input.field-input').forEach((input) => {
    if (input.parentElement?.classList.contains("input-clear")) return;
    const wrap = document.createElement("span");
    wrap.className = "input-clear";
    input.replaceWith(wrap);
    wrap.appendChild(input);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "clear-btn";
    b.dataset.action = "clear-input";
    b.setAttribute("aria-label", t("input.clear"));
    b.textContent = "✕";
    wrap.appendChild(b);
  });
}

function aboutHref() {
  const lang = getLanguage();
  return lang === "pt-BR" ? "sobre/" : lang === "es" ? "acerca/" : "about/";
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

function dateFormatRows(s) {
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

// ---------- Relógio (vale para os dois mostradores) ----------
function clockSection(s, custom) {
  const c = s.clock;
  // no Minimalista o tipo vem do modo (digital ou analógico); no Customizado escolhe aqui
  let rows = custom ? `
    <div class="segmented" role="group" aria-label="${t("center.type")}">
      <button type="button" data-action="clock-type" data-value="digital" aria-pressed="${c.type === "digital"}">${t("center.digital")}</button>
      <button type="button" data-action="clock-type" data-value="analog" aria-pressed="${c.type === "analog"}">${t("center.analog")}</button>
    </div>` : "";
  if (c.type === "digital") {
    rows += switchRow(null, t("center.hour12"), c.hour12, "", 'data-clock="hour12"');
    rows += switchRow(null, t("center.seconds"), c.seconds, "", 'data-clock="seconds"');
    rows += switchRow(null, t("center.blink"), c.blink, "", 'data-clock="blink"');
    rows += selectRow(null, t("center.font"), FONTS.map((f) => ({ value: f, label: t("font." + f) })), c.font, 'data-clock="font"');
    rows += switchRow(null, t("clock.flip"), c.flip, t("clock.flipHint"), 'data-clock="flip"');
  } else {
    rows += switchRow(null, t("center.analogHourNumbers"), c.analogHourNumbers, "", 'data-clock="analogHourNumbers"');
    rows += switchRow(null, t("center.analogMinuteNumbers"), c.analogMinuteNumbers, "", 'data-clock="analogMinuteNumbers"');
    rows += switchRow(null, t("center.analogMinuteTicks"), c.analogMinuteTicks, "", 'data-clock="analogMinuteTicks"');
    rows += switchRow(null, t("center.analogSeconds"), c.analogSeconds, "", 'data-clock="analogSeconds"');
    if (c.analogSeconds) rows += switchRow(null, t("center.analogSmooth"), c.analogSmooth, t("center.analogSmoothHint"), 'data-clock="analogSmooth"');
  }
  return rows;
}

// ---------- Customizado: posições ----------
function slotLabel(id, s) {
  if (id === s.custom.clockSlot) return "🕐 " + t("comp.clock");
  const type = s.custom.slots[id]?.type || "empty";
  return type === "empty" ? "—" : t("comp." + type);
}

function slotsSection(s) {
  const grid = `
    <div class="slot-grid" role="group" aria-label="${t("group.slots")}">
      ${store.SLOTS.map((id) => {
        const isClock = id === s.custom.clockSlot;
        const filled = isClock || (s.custom.slots[id] && s.custom.slots[id].type !== "empty");
        return `<button type="button" data-action="slot" data-value="${id}" style="grid-area:${id}"
          class="${filled ? "filled" : ""} ${isClock ? "has-clock" : ""}" aria-pressed="${id === selectedSlot}">${slotLabel(id, s)}</button>`;
      }).join("")}
    </div>`;

  const isClock = selectedSlot === s.custom.clockSlot;
  const cfg = s.custom.slots[selectedSlot] || { type: "empty" };
  const options = [{ value: "__clock", label: "🕐 " + t("comp.clock") }, ...SLOT_TYPES.map((x) => ({ value: x, label: t("comp." + x) }))];
  let rows = selectRow(null, t("slots.component"), options, isClock ? "__clock" : cfg.type, "data-slottype");

  if (!isClock) switch (cfg.type) {
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
      if (!s.tempEnabled) rows += hintRow(t("comp.tempOff"), true);
      rows += switchRow(null, t("temp.icon"), cfg.icon !== false, "", 'data-slotfield="icon"');
      rows += switchRow(null, t("temp.condition"), cfg.condition !== false, "", 'data-slotfield="condition"');
      for (const k of WEATHER_EXTRAS) rows += switchRow(null, t("wxopt." + k), !!cfg[k], "", `data-slotfield="${k}"`);
      break;
    case "sun":
      if (!location.hasLocation()) rows += hintRow(t("comp.needsLocation"), true);
      break;
  }

  return group(t("group.slots"), `
    ${hintRow(t("slots.hint"))}
    ${grid}
    ${rows}`);
}

function textEditor(id, value, attr) {
  return `
    <div class="row row-stack">
      <span class="row-label">${t("text.template")}</span>
      <input type="text" class="field-input" id="${id}" ${attr} data-tokens value="${esc(value)}" placeholder="${esc(t("text.placeholder"))}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <span class="row-hint">${t("text.tokens")}</span>
      <div class="chips">${TOKENS.map((tk) => `<button type="button" class="chip" data-action="token" data-target="${id}" data-value="{${tk}}">{${tk}}</button>`).join("")}</div>
      <span class="preview" data-preview="${id}">${t("text.preview")} <b>${esc(expand(value))}</b></span>
    </div>`;
}

// ---------- Customizado: presets ----------
function presetsSection(s) {
  let rows = `
    <div class="row">
      <span class="preset-save">
        <input type="text" class="field-input" id="preset-name" maxlength="40" placeholder="${esc(t("presets.namePlaceholder"))}" autocomplete="off">
        <button type="button" class="btn primary" data-action="preset-save">${t("presets.save")}</button>
      </span>
    </div>`;
  rows += `<div class="row"><span class="row-label"></span>
    <button type="button" class="btn" data-action="share-current">${t("share.current")}</button></div>`;
  if (sharePanel) rows += shareBox();
  if (!s.presets.length) rows += hintRow(t("presets.empty"));
  for (const p of s.presets) {
    rows += `
      <div class="row preset-row">
        <span class="row-label">${esc(p.name)}</span>
        <span class="preset-actions">
          <button type="button" class="btn" data-action="preset-apply" data-value="${esc(p.id)}">${t("presets.apply")}</button>
          <button type="button" class="btn icon-btn" data-action="preset-share" data-value="${esc(p.id)}" aria-label="${esc(t("share.share"))}">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>
          </button>
          <button type="button" class="btn icon-btn" data-action="preset-delete" data-value="${esc(p.id)}" aria-label="${esc(t("presets.delete"))}">✕</button>
        </span>
      </div>`;
  }
  return group(t("group.presets"), rows);
}

function shareBox() {
  return `
    <div class="share-box">
      <div class="share-qr" role="img" aria-label="${esc(t("share.qr"))}">${share.qrSvg(sharePanel.url)}</div>
      <div class="share-side">
        <strong>${esc(sharePanel.title)}</strong>
        <span class="row-hint">${t("share.hint")}</span>
        <code class="share-url">${esc(sharePanel.url)}</code>
        <span class="notice-actions wrap">
          <button type="button" class="btn primary" data-action="share-send">${t("share.share")}</button>
          <button type="button" class="btn" data-action="share-copy">${t("share.copy")}</button>
          <button type="button" class="btn" data-action="share-close">${t("settings.close")}</button>
        </span>
        ${shareMsg ? `<span class="row-hint">${shareMsg}</span>` : ""}
      </div>
    </div>`;
}

// ---------- Backup ----------
function backupSection() {
  return `
    <div class="row">
      <span class="row-label">${t("backup.hint")}</span>
    </div>
    <div class="row">
      <span class="notice-actions wrap" style="margin:0">
        <button type="button" class="btn" data-action="backup-export">${t("backup.export")}</button>
        <button type="button" class="btn" data-action="backup-import">${t("backup.import")}</button>
      </span>
      <input type="file" id="backup-file" accept="application/json,.json" hidden>
    </div>
    ${backupMsg ? hintRow(backupMsg, backupMsg === t("backup.invalid")) : ""}`;
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

// ---------- Localização ----------
function serviceLink(svc) {
  return `<a href="${svc.url}" target="_blank" rel="noopener noreferrer">${esc(svc.name)}</a>`;
}

function locationSection(s) {
  const loc = s.location;
  const st = location.getStatus();
  const mode = loc.mode || "none";
  let rows = selectRow(null, t("loc.source"), [
    { value: "none", label: t("loc.none") },
    { value: "gps", label: t("loc.gps") },
    { value: "ip", label: t("loc.ip") },
    { value: "city", label: t("loc.city") },
  ], locAsk ? "gps" : mode, "data-locmode");

  if (locAsk) {
    rows += `<p class="notice"><strong>${t("temp.askTitle")}</strong><br>${t("loc.gpsAsk")}
      <span class="notice-actions">
        <button type="button" class="btn primary" data-action="gps-allow">${t("temp.allow")}</button>
        <button type="button" class="btn" data-action="gps-cancel">${t("temp.cancel")}</button>
      </span></p>`;
  } else if (st === "denied") {
    rows += `<p class="notice"><strong>${t("temp.denied")}</strong><br>${t("temp.deniedHelp")}<br>${t("loc.deniedAlt")}
      <span class="notice-actions wrap">
        <button type="button" class="btn primary" data-action="gps-allow">${t("temp.retry")}</button>
        <button type="button" class="btn" data-action="loc-ip">${t("loc.ip")}</button>
        <button type="button" class="btn" data-action="loc-city">${t("loc.city")}</button>
      </span></p>`;
  }

  if (mode === "city" || (cityResults && !locAsk)) {
    rows += `
      <div class="row">
        <span class="preset-save">
          <input type="search" class="field-input" id="city-input" value="${esc(cityQuery)}" placeholder="${esc(t("loc.cityPlaceholder"))}" autocomplete="off" enterkeyhint="search">
          <button type="button" class="btn" data-action="city-search">${t("loc.search")}</button>
        </span>
      </div>`;
    if (cityError) rows += hintRow(cityError, true);
    if (cityResults) {
      rows += cityResults.length
        ? `<div class="loc-results">${cityResults.map((r, i) => `<button type="button" data-action="city-pick" data-value="${i}">${esc(r.name)}</button>`).join("")}</div>`
        : hintRow(t("loc.noResults"));
    }
  }

  // status atual
  let status;
  if (st === "locating") status = t("loc.locating");
  else if (st === "error") status = `<span class="warn-text">${t("loc.error")}</span>`;
  else if (location.hasLocation()) {
    const where = loc.name || `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`;
    status = t("loc.current", { where: esc(where) }) + (loc.mode === "ip" ? ` · ${t("loc.approx")}` : "");
  } else status = t("loc.notSet");
  rows += `
    <div class="row">
      <span class="row-label"><span class="row-hint">${status}</span></span>
      ${loc.mode === "gps" || loc.mode === "ip" ? `<button type="button" class="btn" data-action="loc-refresh">${t("loc.refresh")}</button>` : ""}
    </div>`;
  if (loc.mode === "ip") rows += hintRow(t("loc.ipHint"));

  // transparência: quais serviços são usados
  rows += `
    <div class="row"><span class="row-label"><span class="source-note">
      ${t("loc.usedFor")}<br>
      ${t("loc.services")}: ${serviceLink(location.SERVICES.ip)} (${t("loc.svcIp")}) · ${serviceLink(location.SERVICES.geocoding)} (${t("loc.svcCity")})
    </span></span></div>`;
  return rows;
}

// ---------- Temperatura ----------
function temperatureSection(s, lang) {
  const status = weather.getStatus();
  const unit = s.tempUnit || LANGUAGES[lang].defaults.tempUnit;
  const cache = store.getWeatherCache();
  let rows = switchRow("tempEnabled", t("temp.show"), s.tempEnabled);

  if (tempNeedsLocation && !location.hasLocation()) {
    rows += `<p class="notice"><strong>${t("temp.needsLocation")}</strong><br>${t("temp.needsLocationBody")}
      <span class="notice-actions wrap">
        <button type="button" class="btn primary" data-action="loc-gps">${t("loc.gps")}</button>
        <button type="button" class="btn" data-action="loc-ip">${t("loc.ip")}</button>
        <button type="button" class="btn" data-action="loc-city">${t("loc.city")}</button>
      </span></p>`;
  }

  if (s.tempEnabled) {
    let hint;
    if (status === "updating") hint = t("temp.updating");
    else if (status === "nolocation") hint = `<span class="warn-text">${t("temp.needsLocation")}</span>`;
    else if (cache?.updatedAt) hint = t("temp.lastUpdate", { time: formatShortTime(new Date(cache.updatedAt)) });
    else hint = t("temp.never");
    const errorHint = status === "error" ? `<span class="row-hint warn">${t("temp.error")}</span>` : "";
    rows += selectRow("tempUnit", t("temp.unit"), [{ value: "C", label: "°C" }, { value: "F", label: "°F" }], unit);
    rows += switchRow("tempIcon", t("temp.icon"), s.tempIcon);
    rows += switchRow("tempCondition", t("temp.condition"), s.tempCondition, t("temp.conditionHint"));
    rows += `
      <div class="row">
        <span class="row-label"><span class="row-hint">${hint}</span>${errorHint}</span>
        <button type="button" class="btn" data-action="temp-refresh">${t("temp.refresh")}</button>
      </div>`;
  }
  rows += `<div class="row"><span class="row-label"><span class="source-note">
    ${t("temp.source")} ${serviceLink(location.SERVICES.weather)} · ${t("temp.license")}
  </span></span></div>`;
  return rows;
}

// ---------- Pomodoro ----------
function pomodoroSection(s) {
  const p = s.pomo;
  const range = (a, b, step) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
  const mins = (arr) => arr.map((n) => ({ value: n, label: `${n} min` }));
  return `
    ${selectRow(null, t("pomo.focus"), mins([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 90]), p.focus, 'data-pomo="focus"')}
    ${selectRow(null, t("pomo.short"), mins(range(1, 15, 1)), p.short, 'data-pomo="short"')}
    ${selectRow(null, t("pomo.long"), mins(range(5, 45, 5)), p.long, 'data-pomo="long"')}
    ${selectRow(null, t("pomo.cycles"), range(2, 8, 1).map((n) => ({ value: n, label: String(n) })), p.cycles, 'data-pomo="cycles"')}
    ${switchRow(null, t("pomo.autoStart"), p.autoStart, t("pomo.autoStartHint"), 'data-pomo="autoStart"')}
  `;
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
  rows += hintRow(t("sounds.hint"));
  return rows;
}

function wakeLockText() {
  const st = getWakeLockState();
  if (st === "on") return t("general.wakeLockOn");
  if (st === "video") return t("general.wakeLockVideo");
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

function hintRow(text, warn = false) {
  return `<div class="row"><span class="row-label"><span class="row-hint ${warn ? "warn" : ""}">${text}</span></span></div>`;
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

// ---------------- Arrastar e soltar (mini-grade) ----------------
// Eventos de ponteiro (funcionam com toque no iPhone). O alvo é encontrado por elementFromPoint,
// que respeita o giro do app via CSS.
function bindDragAndDrop() {
  let drag = null;
  body.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".slot-grid button");
    if (!b || e.button > 0) return;
    drag = { id: b.dataset.value, el: b, x: e.clientX, y: e.clientY, active: false, target: null, pid: e.pointerId };
  });
  body.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      drag.active = true;
      drag.el.classList.add("dragging");
      try { drag.el.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot-grid button");
    const target = under && under !== drag.el ? under : null;
    if (target !== drag.target) {
      drag.target?.classList.remove("drop-target");
      target?.classList.add("drop-target");
      drag.target = target;
    }
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    d.el.classList.remove("dragging");
    d.target?.classList.remove("drop-target");
    dragJustEnded = true;
    setTimeout(() => { dragJustEnded = false; }, 50);
    if (d.target && e.type === "pointerup") {
      selectedSlot = d.target.dataset.value;
      store.swapSlots(d.id, d.target.dataset.value);
    }
  };
  body.addEventListener("pointerup", end);
  body.addEventListener("pointercancel", end);
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
    } else if ("clock" in d) {
      store.setClock({ [d.clock]: value });
    } else if ("pomo" in d) {
      store.setPomo({ [d.pomo]: typeof value === "boolean" ? value : Number(value) });
    } else if ("timeKey" in d) {
      const p2 = (n) => String(n).padStart(2, "0");
      const [h, m] = String(store.get()[d.timeKey] || "00:00").split(":");
      const next = d.part === "h" ? `${p2(value)}:${m}` : `${h}:${p2(value)}`;
      store.set({ [d.timeKey]: next });
    } else if ("orientation" in d) store.set({ orientation: value ? "landscape" : "auto" });
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
      if (value === "__clock") store.moveClock(selectedSlot);
      else if (selectedSlot === store.get().custom.clockSlot) {
        // o relógio estava aqui: ele volta para o centro (ou troca com o centro)
        const target = selectedSlot === "C" ? "T" : "C";
        store.moveClock(target);
        store.setSlot(selectedSlot, { type: value, ...(SLOT_DEFAULTS[value]?.() || {}) });
      } else {
        store.setSlot(selectedSlot, { type: value, ...(SLOT_DEFAULTS[value]?.() || {}) });
      }
    } else if ("locmode" in d) {
      onLocationMode(value);
    } else if (d.key) {
      store.set({ [d.key]: el.type === "range" ? Number(value) : value });
    }
  } finally {
    suppressRender = false;
  }
  // controle deslizante com % ao lado: atualiza o número enquanto arrasta
  if (el.type === "range" && el.dataset.key === "nightBrightness") {
    const hint = el.closest(".row")?.querySelector(".row-hint");
    if (hint) hint.textContent = Math.round(Number(el.value) * 100) + "%";
  }
  // atualiza a prévia do texto sem redesenhar o painel
  if (el.id) {
    const prev = body.querySelector(`[data-preview="${el.id}"] b`);
    if (prev) prev.textContent = expand(el.value);
  }
}

async function onLocationMode(mode) {
  cityResults = null;
  cityError = "";
  if (mode === "none") { locAsk = false; location.clear(); return; }
  if (mode === "gps") {
    if (await location.gpsPermissionGranted()) { locAsk = false; location.useGPS(); }
    else { locAsk = true; render(); }
    return;
  }
  locAsk = false;
  if (mode === "ip") { location.useIP(); render(); }
  if (mode === "city") { cityResults = []; render(); setTimeout(() => body.querySelector("#city-input")?.focus(), 50); }
}

async function doCitySearch() {
  const input = body.querySelector("#city-input");
  cityQuery = input?.value || "";
  cityError = "";
  try {
    cityResults = await location.searchCity(cityQuery);
  } catch {
    cityResults = null;
    cityError = t("loc.searchError");
  }
  render();
}

function onInput(e) {
  if (e.target.id === "city-input") { cityQuery = e.target.value; return; }
  applyField(e.target, true);
}

async function onChange(e) {
  const el = e.target;
  if (el.id === "city-input" || el.id === "preset-name") return;

  if (el.dataset.key === "tempEnabled") {
    if (el.checked) {
      if (location.hasLocation()) { tempNeedsLocation = false; weather.enable(); }
      else { tempNeedsLocation = true; store.set({ tempEnabled: true }); }
    } else {
      tempNeedsLocation = false;
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

  switch (action) {
    case "theme": store.set({ theme: value }); break;
    case "face": store.set({ face: value }); break;
    case "mode": store.setMode(value); break;
    case "edit-screen": close(); onEditScreen?.(); break;
    case "clock-type": store.setClock({ type: value }); break;
    case "slot": if (!dragJustEnded) { selectedSlot = value; render(); } break;

    case "update-check":
      updateStatus = "checking";
      render();
      update.checkNow().then((r) => { updateStatus = r; refresh(); });
      break;
    case "update-force": update.forceReload(); break;

    case "sound-test": {
      unlockSound();
      const so = store.get().sounds;
      playSound(so[value], so.volume);
      break;
    }

    // localização
    case "gps-allow": locAsk = false; location.useGPS(); render(); break;
    case "gps-cancel": locAsk = false; render(); break;
    case "loc-gps": onLocationMode("gps"); break;
    case "loc-ip": onLocationMode("ip"); break;
    case "loc-city": onLocationMode("city"); break;
    case "loc-refresh": location.refreshNow(); break;
    case "city-search": doCitySearch(); break;
    case "city-pick": {
      const r = cityResults?.[Number(value)];
      if (r) { location.useCity(r); cityResults = null; cityQuery = ""; }
      break;
    }
    case "temp-refresh": weather.refreshNow(); break;
    case "clear-input": {
      const input = btn.parentElement?.querySelector("input");
      if (!input) break;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
      break;
    }

    // presets
    case "preset-save": {
      const name = body.querySelector("#preset-name")?.value;
      store.savePreset(name || `${t("presets.default")} ${store.get().presets.length + 1}`);
      break;
    }
    case "preset-apply": store.applyPreset(value); break;
    case "preset-share": {
      const p = store.get().presets.find((x) => x.id === value);
      if (p) { sharePanel = { url: share.presetLink(p.data, p.name), title: p.name }; shareMsg = ""; render(); }
      break;
    }
    case "share-current":
      sharePanel = { url: share.presetLink(share.currentLayout(), ""), title: t("share.currentTitle") };
      shareMsg = "";
      render();
      break;
    case "share-close": sharePanel = null; render(); break;
    case "share-copy":
      share.copyText(sharePanel.url).then((r) => { shareMsg = t(r === "copied" ? "share.copied" : "share.failed"); render(); });
      break;
    case "share-send":
      share.shareLink(sharePanel.url, "NADA Clock — " + sharePanel.title).then((r) => {
        if (r === "copied" || r === "failed") { shareMsg = t(r === "copied" ? "share.copied" : "share.failed"); render(); }
      });
      break;
    case "backup-export":
      share.exportBackup().then((r) => { backupMsg = r === "cancelled" ? "" : t("backup.exported"); render(); });
      break;
    case "backup-import": {
      const input = body.querySelector("#backup-file");
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return;
        try { await share.importBackup(f); backupMsg = t("backup.imported"); }
        catch { backupMsg = t("backup.invalid"); }
        render();
      };
      input.click();
      break;
    }
    case "preset-delete": store.deletePreset(value); break;

    case "token": {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + value + input.value.slice(end);
      const pos = start + value.length;
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch { /* ok */ }
      applyField(input, true);
      break;
    }

    case "match-main": {
      const fg = store.get().custom.colors.fg;
      store.setCustom("colors", { hours: fg, minutes: fg, seconds: fg });
      break;
    }

    case "reset":
      if (!resetArmed) {
        resetArmed = true;
        render();
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { resetArmed = false; refresh(); }, 4000);
      } else {
        resetArmed = false;
        clearTimeout(resetTimer);
        selectedSlot = "T";
        weather.disable();
        timers.reset();
        pomodoro.reset();
        store.reset();
      }
      break;
  }
}
