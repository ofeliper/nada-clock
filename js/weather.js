// Temperatura atual via Open-Meteo (gratuito, sem chave, sem cadastro).
// A API sempre responde em °C; a conversão para °F é feita aqui, sem nova consulta.
import * as store from "./store.js";

const API = "https://api.open-meteo.com/v1/forecast";
const REFRESH_MS = 30 * 60 * 1000;   // atualiza a cada 30 min
const RETRY_MS = 5 * 60 * 1000;      // após erro, tenta de novo em 5 min

// status: off | locating | updating | ok | denied | error | unsupported
let status = "off";
let lastErrorAt = 0;
const listeners = new Set();

function setStatus(s) {
  status = s;
  listeners.forEach((fn) => fn(status));
}

export function getStatus() {
  return status;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const supported = "geolocation" in navigator;

/** Converte e formata: 22.4 → "22°C" ou "72°F". */
export function formatTemp(tempC, unit) {
  if (tempC == null || Number.isNaN(tempC)) return "";
  const v = unit === "F" ? tempC * 9 / 5 + 32 : tempC;
  return `${Math.round(v)}°${unit}`;
}

/** Pede a localização (dispara o pedido de permissão do sistema na 1ª vez). */
function locate() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        // 2 casas decimais (~1 km) bastam para o clima e preservam a privacidade
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100,
      }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60 * 60 * 1000 }
    );
  });
}

async function fetchCurrent(lat, lon) {
  const url = `${API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const c = json.current || {};
  return { tempC: c.temperature_2m, code: c.weather_code, isDay: c.is_day === 1 };
}

/**
 * Ativa a temperatura: pede localização e busca o clima.
 * Retorna true se deu certo. Em caso de negação, status = "denied".
 */
export async function enable() {
  if (!supported) { setStatus("unsupported"); return false; }
  setStatus("locating");
  try {
    const coords = await locate();
    store.set({ tempEnabled: true });
    await update(coords);
    return true;
  } catch (err) {
    if (err && err.code === 1) {            // PERMISSION_DENIED
      store.set({ tempEnabled: false });
      setStatus("denied");
    } else {
      // posição indisponível / timeout: mantém ligado e tenta depois
      store.set({ tempEnabled: true });
      lastErrorAt = Date.now();
      setStatus("error");
    }
    return false;
  }
}

export function disable() {
  store.set({ tempEnabled: false });
  setStatus("off");
}

/** Busca o clima usando as coordenadas informadas ou as salvas. */
async function update(coords) {
  const cache = store.getWeatherCache() || {};
  const lat = coords?.lat ?? cache.lat;
  const lon = coords?.lon ?? cache.lon;
  if (lat == null || lon == null) return enable();

  setStatus("updating");
  try {
    const data = await fetchCurrent(lat, lon);
    store.setWeatherCache({ ...data, lat, lon, updatedAt: Date.now() });
    setStatus("ok");
  } catch {
    lastErrorAt = Date.now();
    setStatus("error");
  }
}

/** "Atualizar agora": tenta renovar a localização e depois o clima. */
export async function refreshNow() {
  if (!store.get().tempEnabled) return;
  try {
    const coords = await locate();
    await update(coords);
  } catch (err) {
    if (err && err.code === 1) {
      store.set({ tempEnabled: false });
      setStatus("denied");
    } else {
      await update(); // sem localização nova: usa a salva
    }
  }
}

/** Chamado periodicamente: atualiza se o dado estiver velho. */
export function tick() {
  if (!store.get().tempEnabled) return;
  if (status === "locating" || status === "updating") return;
  if (document.visibilityState !== "visible") return;
  const cache = store.getWeatherCache();
  const age = cache?.updatedAt ? Date.now() - cache.updatedAt : Infinity;
  const sinceError = Date.now() - lastErrorAt;
  if (age >= REFRESH_MS && sinceError >= RETRY_MS) update();
}

export function init() {
  if (!supported) { status = "unsupported"; return; }
  if (store.get().tempEnabled) {
    status = store.getWeatherCache()?.updatedAt ? "ok" : "off";
    tick();
  }
}
