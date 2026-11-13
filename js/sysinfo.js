// Informações do sistema (versão, mostrador, brilho, modo noturno…) para pôr na tela.
// Algumas saem daqui mesmo; as que dependem do app são fornecidas pelo app.js (provide).
import * as store from "./store.js";
import { t, getLanguage, LANGUAGES, formatDate, formatShortTime } from "./i18n.js";

/** Ordem em que aparecem no catálogo. */
export const SYS_KEYS = [
  "version", "updated", "face", "clock", "brightness", "night", "awake",
  "network", "language", "timezone", "location", "weatherAt", "orientation",
];

const providers = {};

/** O app.js fornece o que só ele sabe (estado da tela, do brilho, do modo noturno…). */
export function provide(map) { Object.assign(providers, map); }

// data em que esta versão chegou ao aparelho
const VERSION_KEY = "nada-clock:version";
const VERSION_AT_KEY = "nada-clock:versionAt";
export function noteVersion(version) {
  try {
    if (localStorage.getItem(VERSION_KEY) !== version) {
      localStorage.setItem(VERSION_KEY, version);
      localStorage.setItem(VERSION_AT_KEY, String(Date.now()));
    }
  } catch { /* ok */ }
}

function updatedAt() {
  try {
    const at = Number(localStorage.getItem(VERSION_AT_KEY));
    if (!at) return "";
    const s = store.get();
    return formatDate(new Date(at), s.dateFormat, s.dateSeparator);
  } catch { return ""; }
}

/** Valor atual (texto) da informação. */
export function value(key) {
  if (providers[key]) {
    try { return String(providers[key]() ?? ""); } catch { return ""; }
  }
  const s = store.get();
  switch (key) {
    case "updated": return updatedAt();
    case "network": return t(navigator.onLine === false ? "sys.offline" : "sys.online");
    case "language": return LANGUAGES[getLanguage()]?.name || getLanguage();
    case "timezone": {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " "); } catch { return ""; }
    }
    case "location": return s.location?.name || (typeof s.location?.lat === "number" ? `${s.location.lat}, ${s.location.lon}` : t("sys.none"));
    case "weatherAt": {
      const at = store.getWeatherCache()?.updatedAt;
      return at && s.tempEnabled ? formatShortTime(new Date(at)) : t("sys.none");
    }
    default: return "";
  }
}

export const label = (key) => t("sys." + key);
