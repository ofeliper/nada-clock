// Painel de configurações.
import * as store from "./store.js";
import * as weather from "./weather.js";
import { t, LANGUAGES, getLanguage, formatShortTime, formatDate } from "./i18n.js";

export const VERSION = "0.1.0";

const THEMES = ["terminal", "amber", "snow", "ice", "night"];
const THEME_COLORS = { terminal: "#33ff66", amber: "#ffb000", snow: "#e8e8e8", ice: "#5ac8fa", night: "#b3261e" };
const DATE_FORMATS = ["auto", "dmy", "mdy", "ymd", "short", "long"];
const SEPARATORS = ["/", "-", "."];

let root, body, onCloseCb, getWakeLockState;
let asking = false;           // mostrando o aviso "precisamos da localização"

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
  body.addEventListener("click", onClick);

  store.subscribe(() => { if (isOpen()) render(); });
  weather.subscribe(() => { if (isOpen()) render(); });
}

export function isOpen() {
  return root && !root.hidden;
}

export function open() {
  asking = false;
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
  const sample = new Date(2026, 10, 8);

  body.innerHTML = `
    ${group(t("group.display"), `
      <div class="swatches" role="group" aria-label="${t("theme.label")}">
        ${THEMES.map((th) => `
          <button type="button" class="swatch" data-action="theme" data-value="${th}" aria-pressed="${s.theme === th}">
            <span class="swatch-chip" style="color:${THEME_COLORS[th]}">12:34</span>
            ${t("theme." + th)}
          </button>`).join("")}
      </div>
    `)}

    ${group(t("group.info"), `
      ${switchRow("showWeekday", t("info.weekday"), s.showWeekday)}
      ${switchRow("showDate", t("info.date"), s.showDate)}
      ${s.showDate ? selectRow("dateFormat", t("info.dateFormat"), DATE_FORMATS.map((f) => ({
        value: f,
        label: f === "auto" ? `${t("dateFormat.auto")} — ${formatDate(sample, "auto", s.dateSeparator)}` : `${t("dateFormat." + f)}${["short", "long"].includes(f) ? " — " + formatDate(sample, f) : ""}`,
      })), s.dateFormat) : ""}
      ${s.showDate && usesSeparator(s.dateFormat, lang) ? selectRow("dateSeparator", t("info.separator"),
        SEPARATORS.map((x) => ({ value: x, label: x })), s.dateSeparator) : ""}
    `)}

    ${group(t("group.temperature"), temperatureSection(s, lang))}

    ${group(t("group.night"), `
      ${switchRow("nightEnabled", t("night.enabled"), s.nightEnabled, t("night.hint"))}
      ${s.nightEnabled ? `
        <div class="row"><span class="row-label">${t("night.start")}</span><input type="time" data-key="nightStart" value="${s.nightStart}"></div>
        <div class="row"><span class="row-label">${t("night.end")}</span><input type="time" data-key="nightEnd" value="${s.nightEnd}"></div>
      ` : ""}
    `)}

    ${group(t("group.general"), `
      ${selectRow("language", t("general.language"), [
        { value: "auto", label: t("general.languageAuto") },
        ...Object.entries(LANGUAGES).map(([k, v]) => ({ value: k, label: v.name })),
      ], s.language)}
      ${switchRow("burnIn", t("general.burnin"), s.burnIn, t("general.burninHint"))}
      <div class="row">
        <span class="row-label">${t("general.wakeLock")}
          <span class="row-hint ${getWakeLockState() === "on" ? "" : "warn"}">${wakeLockText()}</span>
        </span>
      </div>
    `)}

    <div class="about">
      <b>NADA CLOCK</b> · v${VERSION}<br>
      ${t("about.tagline")}<br>
      ${t("about.gestures")}
    </div>
  `;
  body.scrollTop = scroll;
}

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

function usesSeparator(format, lang) {
  if (format === "dmy" || format === "mdy") return true;
  if (format === "auto") return true; // auto vira dmy/mdy conforme o idioma
  return false;
}

function wakeLockText() {
  const st = getWakeLockState();
  if (st === "on") return t("general.wakeLockOn");
  if (st === "unsupported") return t("general.wakeLockUnsupported");
  return t("general.wakeLockOff");
}

// ---------------- Helpers de HTML ----------------

function group(title, inner) {
  return `<div class="group"><h3 class="group-title">${title}</h3><div class="card">${inner}</div></div>`;
}

function switchRow(key, label, checked, hint) {
  return `
    <label class="row">
      <span class="row-label">${label}${hint ? `<span class="row-hint">${hint}</span>` : ""}</span>
      <span class="switch"><input type="checkbox" data-key="${key}" ${checked ? "checked" : ""}><span></span></span>
    </label>`;
}

function selectRow(key, label, options, value) {
  return `
    <label class="row">
      <span class="row-label">${label}</span>
      <select data-key="${key}">
        ${options.map((o) => `<option value="${o.value}" ${String(o.value) === String(value) ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>
    </label>`;
}

// ---------------- Eventos ----------------

async function onChange(e) {
  const el = e.target;
  const key = el.dataset.key;
  if (!key) return;

  if (key === "tempEnabled") {
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

  const value = el.type === "checkbox" ? el.checked : el.value;
  store.set({ [key]: value });
}

function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, value } = btn.dataset;

  if (action === "theme") store.set({ theme: value });
  if (action === "temp-allow") { asking = false; weather.enable(); render(); }
  if (action === "temp-cancel") { asking = false; render(); }
  if (action === "temp-refresh") weather.refreshNow();
}

async function permissionGranted() {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return p?.state === "granted";
  } catch {
    return false;
  }
}
