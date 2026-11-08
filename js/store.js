// Preferências do usuário, salvas só neste aparelho (localStorage).
const KEY = "nada-clock:settings:v1";
const WEATHER_KEY = "nada-clock:weather:v1";

export const DEFAULTS = {
  language: "auto",        // auto | pt-BR | en-US
  face: "minimal",         // minimal | custom (em breve)
  theme: "terminal",       // terminal | amber | snow | ice | night
  showDate: true,
  showWeekday: true,
  dateFormat: "auto",      // auto | dmy | mdy | ymd | short | long
  dateSeparator: "/",      // / | - | .
  tempEnabled: false,
  tempUnit: null,          // null = padrão do idioma; "C" | "F"
  nightEnabled: false,
  nightStart: "22:00",
  nightEnd: "07:00",
  burnIn: true,
  brightness: 1,           // 0.05 – 1
};

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue sem salvar */
  }
}

let state = { ...DEFAULTS, ...(readJSON(KEY) || {}) };
const listeners = new Set();

export function get() {
  return state;
}

export function set(patch) {
  state = { ...state, ...patch };
  writeJSON(KEY, state);
  listeners.forEach((fn) => fn(state, patch));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Cache do clima: { tempC, code, updatedAt, lat, lon } ----
export function getWeatherCache() {
  return readJSON(WEATHER_KEY);
}

export function setWeatherCache(data) {
  writeJSON(WEATHER_KEY, data);
}
