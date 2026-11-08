// Temperatura atual via Open-Meteo (gratuito, sem chave, sem cadastro — https://open-meteo.com/).
// Usa a localização escolhida em location.js. A API responde em °C; a conversão para °F é local.
import * as store from "./store.js";

const API = "https://api.open-meteo.com/v1/forecast";
const REFRESH_MS = 30 * 60 * 1000;   // atualiza a cada 30 min
const RETRY_MS = 5 * 60 * 1000;      // após erro, tenta de novo em 5 min

// status: off | updating | ok | error | nolocation
let status = "off";
let lastErrorAt = 0;
const listeners = new Set();

function setStatus(s) {
  status = s;
  listeners.forEach((fn) => fn(status));
}

export const getStatus = () => status;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Converte e formata: 22.4 → "22°C" ou "72°F". */
export function formatTemp(tempC, unit) {
  if (tempC == null || Number.isNaN(tempC)) return "";
  const v = unit === "F" ? tempC * 9 / 5 + 32 : tempC;
  return `${Math.round(v)}°${unit}`;
}

const CURRENT = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation";
const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_probability_max";

async function fetchCurrent(lat, lon) {
  const url = `${API}?latitude=${lat}&longitude=${lon}&current=${CURRENT}&daily=${DAILY}&forecast_days=1&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const c = json.current || {};
  const d = json.daily || {};
  const first = (arr) => (Array.isArray(arr) ? arr[0] : null);
  return {
    tempC: c.temperature_2m,
    feelsC: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    code: c.weather_code,
    isDay: c.is_day === 1,
    windKmh: c.wind_speed_10m,
    precipMm: c.precipitation,
    tmaxC: first(d.temperature_2m_max),
    tminC: first(d.temperature_2m_min),
    rainProb: first(d.precipitation_probability_max),
  };
}

export async function update() {
  const loc = store.get().location;
  if (typeof loc?.lat !== "number") { setStatus("nolocation"); return; }
  setStatus("updating");
  try {
    const data = await fetchCurrent(loc.lat, loc.lon);
    store.setWeatherCache({ ...data, lat: loc.lat, lon: loc.lon, updatedAt: Date.now() });
    setStatus("ok");
  } catch {
    lastErrorAt = Date.now();
    setStatus("error");
  }
}

export function enable() {
  store.set({ tempEnabled: true });
  return update();
}

export function disable() {
  store.set({ tempEnabled: false });
  setStatus("off");
}

export const refreshNow = () => update();

/** Texto da condição do tempo a partir do código WMO (ex.: 65 → "Chuva forte"). */
export function conditionKey(code, isDay = true) {
  if (code == null) return null;
  if ((code === 0 || code === 1) && !isDay) return `wx.${code}n`;
  return `wx.${code}`;
}

// Ícones simples (traço), na cor do relógio
const I = (body) => `<svg class="wx-ic" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
const MOON = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>';
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18Z"/>';
const SMALL_CLOUD = '<path d="M9 19h8.5a3.2 3.2 0 0 0 .4-6.4 4.8 4.8 0 0 0-9.1 1.3A2.6 2.6 0 0 0 9 19Z"/>';
const ICONS = {
  clearDay: I(SUN),
  clearNight: I(MOON),
  partlyDay: I('<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/>' + SMALL_CLOUD),
  partlyNight: I('<path d="M12 6.5A4.5 4.5 0 1 1 5.5 2a3.6 3.6 0 0 0 6.5 4.5Z"/>' + SMALL_CLOUD),
  cloud: I(CLOUD),
  fog: I('<path d="M4 9h16M3 13h18M5 17h14"/>'),
  drizzle: I(CLOUD.replace("18h10", "15h10").replace("0 0 7 18Z", "0 0 7 15Z") + '<path d="M9 19v1M13 19v1M17 19v1"/>'),
  rain: I(CLOUD.replace("18h10", "14h10").replace("0 0 7 18Z", "0 0 7 14Z") + '<path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>'),
  snow: I(CLOUD.replace("18h10", "14h10").replace("0 0 7 18Z", "0 0 7 14Z") + '<path d="M8 18h.01M12 20h.01M16 18h.01M10 21.5h.01M14 21.5h.01"/>'),
  thunder: I(CLOUD.replace("18h10", "14h10").replace("0 0 7 18Z", "0 0 7 14Z") + '<path d="M12.5 15 10 19h4l-2.5 4"/>'),
};

/** Ícone SVG da condição do tempo (código WMO). */
export function conditionIcon(code, isDay = true) {
  if (code == null) return "";
  if (code === 0 || code === 1) return isDay ? ICONS.clearDay : ICONS.clearNight;
  if (code === 2) return isDay ? ICONS.partlyDay : ICONS.partlyNight;
  if (code === 3) return ICONS.cloud;
  if (code === 45 || code === 48) return ICONS.fog;
  if (code >= 51 && code <= 57) return ICONS.drizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ICONS.rain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ICONS.snow;
  if (code >= 95) return ICONS.thunder;
  return ICONS.cloud;
}

/** Chamado periodicamente: atualiza se o dado estiver velho ou se a localização mudou. */
export function tick() {
  if (!store.get().tempEnabled) return;
  if (status === "updating" || document.visibilityState !== "visible") return;
  const loc = store.get().location;
  if (typeof loc?.lat !== "number") { if (status !== "nolocation") setStatus("nolocation"); return; }
  const cache = store.getWeatherCache();
  const moved = !cache || cache.lat !== loc.lat || cache.lon !== loc.lon || cache.feelsC === undefined; // sem os campos novos (v0.5.1): busca de novo
  const age = cache?.updatedAt ? Date.now() - cache.updatedAt : Infinity;
  const sinceError = Date.now() - lastErrorAt;
  if ((moved || age >= REFRESH_MS) && sinceError >= RETRY_MS) update();
}

export function init() {
  if (store.get().tempEnabled) {
    status = store.getWeatherCache()?.updatedAt ? "ok" : "off";
    tick();
  }
}
