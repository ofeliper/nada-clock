// Localização: usada pela temperatura, pelo nascer/pôr do sol e pelo hemisfério da lua.
// Três fontes:
//   gps  — localização do aparelho (pede permissão)
//   ip   — aproximada pelo endereço IP, sem permissão (GeoJS)
//   city — cidade escolhida pela pessoa (busca do Open-Meteo)
// Tudo fica salvo só neste aparelho.
import * as store from "./store.js";
import { getLanguage } from "./i18n.js";

export const SERVICES = {
  ip: { name: "GeoJS", url: "https://www.geojs.io/" },
  geocoding: { name: "Open-Meteo Geocoding", url: "https://open-meteo.com/en/docs/geocoding-api" },
  weather: { name: "Open-Meteo", url: "https://open-meteo.com/" },
};

const IP_API = "https://get.geojs.io/v1/ip/geo.json";
const GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search";
const IP_REFRESH_MS = 6 * 60 * 60 * 1000;   // IP: renova a cada 6 h
const GPS_REFRESH_MS = 2 * 60 * 60 * 1000;  // GPS: renova a cada 2 h (se a permissão já existe)

export const gpsSupported = "geolocation" in navigator;

// status: idle | locating | ok | denied | error
let status = "idle";
const listeners = new Set();
function setStatus(s) { status = s; listeners.forEach((fn) => fn(status)); }
export const getStatus = () => status;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const round2 = (n) => Math.round(Number(n) * 100) / 100;   // ~1 km: suficiente e mais privado

export const hasLocation = () => typeof store.get().location?.lat === "number";

// ---------------- GPS ----------------
function gpsPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: round2(pos.coords.latitude), lon: round2(pos.coords.longitude) }),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60 * 60 * 1000 }
    );
  });
}

export async function useGPS() {
  if (!gpsSupported) { setStatus("error"); return false; }
  setStatus("locating");
  try {
    const { lat, lon } = await gpsPosition();
    store.setLocation({ mode: "gps", lat, lon, name: "", updatedAt: Date.now() });
    setStatus("ok");
    return true;
  } catch (err) {
    setStatus(err && err.code === 1 ? "denied" : "error");
    return false;
  }
}

export async function gpsPermissionGranted() {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" });
    return p?.state === "granted";
  } catch {
    return false;
  }
}

// ---------------- IP ----------------
export async function useIP() {
  setStatus("locating");
  try {
    const res = await fetch(IP_API, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const lat = parseFloat(j.latitude), lon = parseFloat(j.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("no coords");
    const name = [j.city, j.region && j.region !== j.city ? j.region : "", j.country_code].filter(Boolean).join(", ");
    store.setLocation({ mode: "ip", lat: round2(lat), lon: round2(lon), name, updatedAt: Date.now() });
    setStatus("ok");
    return true;
  } catch {
    setStatus("error");
    return false;
  }
}

// ---------------- Cidade ----------------
export async function searchCity(query) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const lang = getLanguage().slice(0, 2);
  const url = `${GEOCODE_API}?name=${encodeURIComponent(q)}&count=8&language=${lang}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  return (j.results || []).map((r) => ({
    lat: round2(r.latitude),
    lon: round2(r.longitude),
    name: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : "", r.country_code || r.country].filter(Boolean).join(", "),
  }));
}

export function useCity(place) {
  store.setLocation({ mode: "city", lat: place.lat, lon: place.lon, name: place.name, updatedAt: Date.now() });
  setStatus("ok");
}

export function clear() {
  store.setLocation({ mode: null, lat: null, lon: null, name: "", updatedAt: 0 });
  setStatus("idle");
}

/** "Atualizar localização" (GPS ou IP). */
export function refreshNow() {
  const m = store.get().location.mode;
  if (m === "gps") return useGPS();
  if (m === "ip") return useIP();
  return Promise.resolve(true);
}

/** Chamado periodicamente: renova GPS/IP quando antigo (sem incomodar a pessoa). */
export async function tick() {
  const loc = store.get().location;
  if (!loc.mode || status === "locating" || document.visibilityState !== "visible") return;
  const age = Date.now() - (loc.updatedAt || 0);
  if (loc.mode === "ip" && age > IP_REFRESH_MS) useIP();
  if (loc.mode === "gps" && age > GPS_REFRESH_MS && await gpsPermissionGranted()) useGPS();
}
