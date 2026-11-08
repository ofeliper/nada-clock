// Preferências do usuário, salvas só neste aparelho (localStorage).
const KEY = "nada-clock:settings:v1";
const WEATHER_KEY = "nada-clock:weather:v1";

/** Slots editáveis no Customizado. TR fica reservado para o botão de configurações. */
export const EDITABLE_SLOTS = ["TL", "T", "L", "C", "R", "BL", "B", "BR"];

export const DEFAULT_CUSTOM = {
  center: {
    type: "digital",        // digital | analog | text
    hour12: false,
    seconds: true,
    blink: false,           // dois-pontos piscando
    font: "thin",           // thin | regular | bold | mono | rounded
    analogSeconds: true,    // ponteiro de segundos no analógico
    text: "{HH}:{mm}",
  },
  slots: {
    TL: { type: "empty" },
    T:  { type: "empty" },
    L:  { type: "empty" },
    R:  { type: "empty" },
    BL: { type: "empty" },
    B:  { type: "weekdayDate" },
    BR: { type: "empty" },
  },
  colors: {
    enabled: false,
    bg: "#000000",
    fg: "#33ff66",
    hours: "#33ff66",
    minutes: "#33ff66",
    seconds: "#33ff66",
  },
};

export const DEFAULTS = {
  language: "auto",        // auto | pt-BR | en-US
  face: "minimal",         // minimal | custom
  theme: "system",         // system | terminal | amber | snow | ice | night | paper
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
  custom: DEFAULT_CUSTOM,
};

const clone = (o) => JSON.parse(JSON.stringify(o));

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
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado ou armazenamento bloqueado: segue sem salvar */
  }
}

/** Junta o que foi salvo com os padrões (inclusive campos novos de versões futuras). */
function hydrate(saved) {
  const base = clone(DEFAULTS);
  if (!saved || typeof saved !== "object") return base;
  const out = { ...base, ...saved };
  const c = saved.custom || {};
  out.custom = {
    center: { ...base.custom.center, ...(c.center || {}) },
    slots: { ...base.custom.slots, ...(c.slots || {}) },
    colors: { ...base.custom.colors, ...(c.colors || {}) },
  };
  return out;
}

let state = hydrate(readJSON(KEY));
const listeners = new Set();

export function get() {
  return state;
}

export function set(patch) {
  state = { ...state, ...patch };
  writeJSON(KEY, state);
  listeners.forEach((fn) => fn(state, patch));
}

/** Atualiza parte do mostrador Customizado. Ex.: setCustom("center", { seconds: false }) */
export function setCustom(section, patch) {
  const custom = clone(state.custom);
  custom[section] = { ...custom[section], ...patch };
  set({ custom });
}

/** Troca o componente (ou suas opções) de um slot do Customizado. */
export function setSlot(slot, value) {
  const custom = clone(state.custom);
  custom.slots[slot] = value;
  set({ custom });
}

/** Volta tudo à configuração original. */
export function reset() {
  writeJSON(WEATHER_KEY, null);
  const fresh = clone(DEFAULTS);
  const patch = Object.fromEntries(Object.keys(fresh).map((k) => [k, fresh[k]]));
  state = fresh;
  writeJSON(KEY, state);
  listeners.forEach((fn) => fn(state, patch));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Cache do clima: { tempC, code, isDay, updatedAt, lat, lon } ----
export function getWeatherCache() {
  return readJSON(WEATHER_KEY);
}

export function setWeatherCache(data) {
  writeJSON(WEATHER_KEY, data);
}
