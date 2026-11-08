// Placeholders ("tokens") para o componente de texto livre.
// Os nomes são em inglês (neutros); o resultado sai no idioma do app.
import * as store from "./store.js";
import { formatDate, formatWeekday, getLanguage, LANGUAGES } from "./i18n.js";
import { formatTemp } from "./weather.js";

const pad = (n) => String(n).padStart(2, "0");

export function currentTempText() {
  const s = store.get();
  if (!s.tempEnabled) return "";
  const w = store.getWeatherCache();
  if (w?.tempC == null) return "";
  const unit = s.tempUnit || LANGUAGES[getLanguage()].defaults.tempUnit;
  return formatTemp(w.tempC, unit);
}

/** Lista exibida no editor (ordem = ordem dos botões). */
export const TOKENS = [
  "HH", "hh", "mm", "ss", "ampm",
  "weekday", "wd", "day", "month", "monthName", "mon", "year", "date",
  "temp",
];

function value(token, now) {
  const s = store.get();
  const lang = getLanguage();
  switch (token) {
    case "HH": return pad(now.getHours());
    case "hh": return pad(now.getHours() % 12 || 12);
    case "mm": return pad(now.getMinutes());
    case "ss": return pad(now.getSeconds());
    case "ampm": return now.getHours() < 12 ? "AM" : "PM";
    case "weekday": return formatWeekday(now, "long");
    case "wd": return formatWeekday(now, "short");
    case "day": return pad(now.getDate());
    case "month": return pad(now.getMonth() + 1);
    case "monthName": return new Intl.DateTimeFormat(lang, { month: "long" }).format(now);
    case "mon": return new Intl.DateTimeFormat(lang, { month: "short" }).format(now).replace(/\./g, "");
    case "year": return String(now.getFullYear());
    case "date": return formatDate(now, s.dateFormat, s.dateSeparator);
    case "temp": return currentTempText();
    default: return null;
  }
}

/** "Bom dia, {weekday}!" → "Bom dia, domingo!" (tokens desconhecidos ficam como estão). */
export function expand(template, now = new Date()) {
  return String(template || "").replace(/\{(\w+)\}/g, (m, tok) => {
    const v = value(tok, now);
    return v == null ? m : v;
  });
}
