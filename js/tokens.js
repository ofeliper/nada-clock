// Placeholders ("tokens") para o componente de texto livre.
// Os nomes são em inglês (neutros); o resultado sai no idioma do app.
import * as store from "./store.js";
import { formatDate, formatWeekday, getLanguage, LANGUAGES, t } from "./i18n.js";
import { formatTemp, conditionKey } from "./weather.js";
import { SYS_KEYS, value as sysValue } from "./sysinfo.js";

const pad = (n) => String(n).padStart(2, "0");

const tempUnit = () => store.get().tempUnit || LANGUAGES[getLanguage()].defaults.tempUnit;

/** Dados do clima, ou null se a temperatura está desligada / sem dados. */
export function weatherData() {
  if (!store.get().tempEnabled) return null;
  const w = store.getWeatherCache();
  return w?.tempC == null ? null : w;
}

export function currentTempText() {
  const w = weatherData();
  return w ? formatTemp(w.tempC, tempUnit()) : "";
}

/** "Chuva forte", "Ensolarado"… */
export function conditionText() {
  const w = weatherData();
  if (!w) return "";
  const key = conditionKey(w.code, w.isDay);
  const txt = key ? t(key) : "";
  return txt === key ? "" : txt;
}

const lowerFirst = (s) => (s ? s.charAt(0).toLocaleLowerCase(getLanguage()) + s.slice(1) : s);

/** "17°C, chuva forte" (ou só "17°C" sem a condição). */
export function tempWithCondition(withCondition = true) {
  const temp = currentTempText();
  if (!temp) return "";
  const cond = withCondition ? conditionText() : "";
  return cond ? `${temp}, ${lowerFirst(cond)}` : temp;
}

const deg = (c) => {
  if (c == null) return "";
  const v = tempUnit() === "F" ? c * 9 / 5 + 32 : c;
  return `${Math.round(v)}°`;
};

/** Detalhes extras do clima, já formatados. */
export function weatherExtra(kind) {
  const w = weatherData();
  if (!w) return "";
  switch (kind) {
    case "feels": return w.feelsC == null ? "" : t("wx.feels", { v: formatTemp(w.feelsC, tempUnit()) });
    case "minmax": return w.tmaxC == null ? "" : t("wx.minmax", { max: deg(w.tmaxC), min: deg(w.tminC) });
    case "humidity": return w.humidity == null ? "" : t("wx.humidity", { v: Math.round(w.humidity) });
    case "rain": return w.rainProb == null ? "" : t("wx.rain", { v: Math.round(w.rainProb) });
    case "wind": {
      if (w.windKmh == null) return "";
      const mph = tempUnit() === "F";
      return t("wx.wind", { v: Math.round(mph ? w.windKmh / 1.609 : w.windKmh), u: mph ? "mph" : "km/h" });
    }
    default: return "";
  }
}

/** Lista exibida no editor (ordem = ordem dos botões). */
export const TOKENS = [
  "HH", "hh", "mm", "ss", "ampm",
  "weekday", "wd", "day", "month", "monthName", "mon", "year", "date",
  "temp", "weather", "feels", "tmax", "tmin", "humidity", "rain",
  ...SYS_KEYS,
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
    case "weather": return conditionText();
    case "feels": { const w = weatherData(); return w?.feelsC == null ? "" : formatTemp(w.feelsC, tempUnit()); }
    case "tmax": { const w = weatherData(); return w?.tmaxC == null ? "" : deg(w.tmaxC); }
    case "tmin": { const w = weatherData(); return w?.tminC == null ? "" : deg(w.tminC); }
    case "humidity": { const w = weatherData(); return w?.humidity == null ? "" : `${Math.round(w.humidity)}%`; }
    case "rain": { const w = weatherData(); return w?.rainProb == null ? "" : `${Math.round(w.rainProb)}%`; }
    default: return SYS_KEYS.includes(token) ? sysValue(token) : null;
  }
}

/** "Bom dia, {weekday}!" → "Bom dia, domingo!" (tokens desconhecidos ficam como estão). */
export function expand(template, now = new Date()) {
  return String(template || "").replace(/\{(\w+)\}/g, (m, tok) => {
    const v = value(tok, now);
    return v == null ? m : v;
  });
}
