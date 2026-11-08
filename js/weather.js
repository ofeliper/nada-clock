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
