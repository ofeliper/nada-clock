// Preferências do usuário, salvas só neste aparelho (localStorage).
const KEY = "nada-clock:settings:v1";
const WEATHER_KEY = "nada-clock:weather:v1";

/**
 * Posições da grade:
 *   TL  TE  TR      ← borda de cima
 *       T           ← logo acima do relógio
 *   L   C   R       ← linha do relógio
 *       B           ← logo abaixo do relógio
 *   BL  BE  BR      ← borda de baixo
 */
export const SLOTS = ["TL", "TE", "TR", "T", "L", "C", "R", "B", "BL", "BE", "BR"];

/** Opções do relógio — valem para o Minimalista e para o Customizado. */
export const DEFAULT_CLOCK = {
  type: "digital",          // digital | analog
  hour12: false,
  seconds: true,
  blink: false,             // dois-pontos piscando
  font: "rounded",          // thin | regular | bold | mono | rounded
  analogSeconds: true,      // ponteiro de segundos
  analogSmooth: false,      // ponteiro de segundos deslizando (contínuo)
  analogHourNumbers: false,
  analogMinuteNumbers: false,
  analogMinuteTicks: false, // marcas de cada minuto
};

const emptySlots = () => Object.fromEntries(SLOTS.map((s) => [s, { type: "empty" }]));

export const DEFAULT_CUSTOM = {
  clockSlot: "C",           // onde o relógio fica
  slots: { ...emptySlots(), T: { type: "weekdayDate" } },
  colors: {
    enabled: false,
    bg: "#000000",
    fg: "#33ff66",
    hours: "#33ff66",
    minutes: "#33ff66",
    seconds: "#33ff66",
  },
};

export const DEFAULT_SOUNDS = {
  volume: 0.6,
  muteAtNight: true,      // silencia durante o modo noturno
  second: false, secondSound: "tic",
  minute: false, minuteSound: "bip",
  hour: false, hourSound: "chime", hourRepeat: false,   // repetir conforme a hora (3h = 3 toques)
  custom: false, customSound: "soft",
  customMode: "every",    // every = a cada X minutos | at = no minuto X de cada hora
  customValue: 15,
  timerSound: "chime",    // alarme do timer e do pomodoro
};

export const DEFAULT_POMO = {
  focus: 25,              // minutos
  short: 5,
  long: 15,
  cycles: 4,              // focos até a pausa longa
  autoStart: false,       // começa a próxima fase sozinho
};

export const DEFAULT_LOCATION = {
  mode: null,             // null | gps | ip | city
  lat: null,
  lon: null,
  name: "",
  updatedAt: 0,
};

export const DEFAULTS = {
  language: "auto",        // auto | pt-BR | en-US
  face: "minimal",         // minimal | custom
  theme: "system",         // system | terminal | amber | snow | ice | night | paper
  clock: DEFAULT_CLOCK,
  showDate: true,
  showWeekday: true,
  infoPosition: "top",     // Minimalista: linha de informações acima (top) ou abaixo (bottom) do relógio
  dateFormat: "auto",      // auto | dmy | mdy | ymd | short | long
  dateSeparator: "/",      // / | - | .
  tempEnabled: false,
  tempUnit: null,          // null = padrão do idioma; "C" | "F"
  tempCondition: true,     // mostra a condição junto: "17°C, chuva forte"
  location: DEFAULT_LOCATION,
  nightEnabled: false,
  nightStart: "22:00",
  nightEnd: "07:00",
  burnIn: true,
  brightness: 1,           // 0.05 – 1
  tab: "clock",            // clock | timer | stopwatch | pomodoro
  orientation: "auto",     // auto | landscape (forçar horizontal)
  rotateDir: "left",       // lado da câmera quando forçado: left | right
  uiTheme: "auto",         // aparência do menu: auto | dark | light
  sounds: DEFAULT_SOUNDS,
  pomo: DEFAULT_POMO,
  custom: DEFAULT_CUSTOM,
  presets: [],             // presets salvos do Customizado
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

/** Junta o que foi salvo com os padrões e migra formatos de versões anteriores. */
function hydrate(saved) {
  const base = clone(DEFAULTS);
  if (!saved || typeof saved !== "object") return base;
  const out = { ...base, ...saved };
  const c = saved.custom || {};

  // v0.4 → v0.5: as opções do relógio saíram de custom.center para clock (compartilhado)
  let clock = { ...base.clock, ...(saved.clock || {}) };
  if (!saved.clock && c.center) {
    const { type, text, ...rest } = c.center;
    clock = { ...clock, ...rest, type: type === "analog" ? "analog" : "digital" };
  }
  out.clock = clock;

  // mantém o que a pessoa já tinha montado; só completa as posições novas (TE, BE, C)
  const slots = c.slots ? { ...emptySlots(), ...c.slots } : base.custom.slots;
  out.custom = {
    clockSlot: SLOTS.includes(c.clockSlot) ? c.clockSlot : "C",
    slots,
    colors: { ...base.custom.colors, ...(c.colors || {}) },
  };

  out.sounds = { ...base.sounds, ...(saved.sounds || {}) };
  out.pomo = { ...base.pomo, ...(saved.pomo || {}) };
  out.location = { ...base.location, ...(saved.location || {}) };
  out.presets = Array.isArray(saved.presets) ? saved.presets : [];

  // v0.4 → v0.5: localização ficava junto do clima (GPS)
  if (!saved.location) {
    const w = readJSON(WEATHER_KEY);
    if (w && typeof w.lat === "number") out.location = { mode: "gps", lat: w.lat, lon: w.lon, name: "", updatedAt: w.updatedAt || 0 };
  }
  return out;
}

let state = hydrate(readJSON(KEY));
writeJSON(KEY, state);
const listeners = new Set();

export function get() {
  return state;
}

export function set(patch) {
  state = { ...state, ...patch };
  writeJSON(KEY, state);
  listeners.forEach((fn) => fn(state, patch));
}

/** Atualiza parte do mostrador Customizado. Ex.: setCustom("colors", { fg: "#fff" }) */
export function setCustom(section, patch) {
  const custom = clone(state.custom);
  custom[section] = typeof patch === "object" && !Array.isArray(patch) && typeof custom[section] === "object"
    ? { ...custom[section], ...patch } : patch;
  set({ custom });
}

/** Atualiza as opções do relógio. */
export function setClock(patch) {
  set({ clock: { ...state.clock, ...patch } });
}

/** Atualiza os sons. Ex.: setSounds({ minute: true }) */
export function setSounds(patch) {
  set({ sounds: { ...state.sounds, ...patch } });
}

export function setPomo(patch) {
  set({ pomo: { ...state.pomo, ...patch } });
}

export function setLocation(patch) {
  set({ location: { ...state.location, ...patch } });
}

/** Troca o componente (ou suas opções) de um slot do Customizado. */
export function setSlot(slot, value) {
  const custom = clone(state.custom);
  custom.slots[slot] = value;
  set({ custom });
}

/** Troca o conteúdo de duas posições (inclusive o relógio). */
export function swapSlots(a, b) {
  if (a === b) return;
  const custom = clone(state.custom);
  const tmp = custom.slots[a] || { type: "empty" };
  custom.slots[a] = custom.slots[b] || { type: "empty" };
  custom.slots[b] = tmp;
  if (custom.clockSlot === a) custom.clockSlot = b;
  else if (custom.clockSlot === b) custom.clockSlot = a;
  set({ custom });
}

/** Move o relógio para uma posição (o que estava lá vai para o lugar antigo do relógio). */
export function moveClock(slot) {
  const from = state.custom.clockSlot;
  if (from === slot) return;
  swapSlots(from, slot);
}

// ---- Presets do Customizado ----
export function savePreset(name) {
  const preset = {
    id: Date.now().toString(36),
    name: String(name || "").trim().slice(0, 40) || "Preset",
    data: clone({ custom: state.custom, clock: state.clock, theme: state.theme }),
  };
  set({ presets: [...state.presets, preset] });
  return preset;
}

export function applyPreset(id) {
  const p = state.presets.find((x) => x.id === id);
  if (!p) return;
  const d = clone(p.data);
  set({ face: "custom", custom: { ...clone(DEFAULT_CUSTOM), ...d.custom }, clock: { ...DEFAULT_CLOCK, ...d.clock }, theme: d.theme || state.theme });
}

export function deletePreset(id) {
  set({ presets: state.presets.filter((x) => x.id !== id) });
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
