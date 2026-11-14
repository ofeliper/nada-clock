// Placeholders ("tokens") para o componente de texto livre.
// Os nomes são em inglês (neutros); o resultado sai no idioma do app.
import * as store from "./store.js";
import { formatDate, formatWeekday, getLanguage, LANGUAGES, t } from "./i18n.js";
import { formatTemp, conditionKey } from "./weather.js";
import { SYS_KEYS, value as sysValue } from "./sysinfo.js";
import { phaseName, moonPhase, sunTimes, progressRatio, countdownText, zoneCity } from "./components.js";

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

/** Variáveis por grupo (ordem = ordem dos botões no editor de texto). */
export const TOKEN_GROUPS = {
  time: ["HH", "hh", "mm", "ss", "ampm", "tzTime", "tzCity"],
  date: ["weekday", "wd", "day", "month", "monthName", "mon", "year", "date"],
  weather: ["temp", "weather", "feels", "tmax", "tmin", "humidity", "rain", "wind"],
  sky: ["moon", "sunrise", "sunset"],
  count: ["dayPct", "weekPct", "monthPct", "yearPct", "countdown"],
  system: SYS_KEYS,
};
export const TOKENS = Object.values(TOKEN_GROUPS).flat();

function hhmm(d) {
  const h12 = !!store.get().clock.hour12;
  return d.toLocaleTimeString(h12 ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit", hour12: h12 });
}

function value(token, now, ctx = {}) {
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
    case "wind": return weatherExtra("wind");
    case "moon": return phaseName(moonPhase(now));
    case "sunrise": case "sunset": {
      const loc = s.location;
      if (typeof loc?.lat !== "number") return "";
      const st = sunTimes(now, loc.lat, loc.lon);
      if (st.polar) return t(st.polar === "day" ? "sun.polarDay" : "sun.polarNight");
      return hhmm(token === "sunrise" ? st.rise : st.set);
    }
    case "dayPct": case "weekPct": case "monthPct": case "yearPct":
      return Math.floor(progressRatio(token.replace("Pct", ""), now) * 100) + "%";
    case "countdown": return countdownText(ctx.date, now);
    case "tzTime": {
      try {
        const h12 = !!s.clock.hour12;
        return new Intl.DateTimeFormat("en-GB", { timeZone: ctx.zone || "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: h12 }).format(now).toUpperCase();
      } catch { return ""; }
    }
    case "tzCity": return ctx.label?.trim() || zoneCity(ctx.zone || "Europe/Lisbon");
    default: return SYS_KEYS.includes(token) ? sysValue(token) : null;
  }
}

/** "Bom dia, {weekday}!" → "Bom dia, domingo!" (tokens desconhecidos ficam como estão). */
export function expand(template, now = new Date(), ctx = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (m, tok) => {
    const v = value(tok, now, ctx);
    return v == null ? m : v;
  });
}
