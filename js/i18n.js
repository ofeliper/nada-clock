// Internacionalização: textos da interface + formatação de datas.
// Datas, meses e dias da semana vêm do próprio navegador (Intl), sem tradução manual.
import ptBR from "./i18n/pt-BR.js";
import enUS from "./i18n/en-US.js";

export const LANGUAGES = {
  "pt-BR": { name: "Português (Brasil)", strings: ptBR, defaults: { tempUnit: "C", dateFormat: "dmy" } },
  "en-US": { name: "English (US)", strings: enUS, defaults: { tempUnit: "F", dateFormat: "mdy" } },
};
export const FALLBACK_LANG = "en-US";

let current = FALLBACK_LANG;

/** Resolve "auto" para um idioma suportado, a partir do idioma do aparelho. */
export function resolveLanguage(pref) {
  if (pref && pref !== "auto" && LANGUAGES[pref]) return pref;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
  for (const c of candidates) {
    const lc = String(c).toLowerCase();
    if (lc.startsWith("pt")) return "pt-BR";
    if (lc.startsWith("en")) return "en-US";
  }
  return FALLBACK_LANG;
}

export function setLanguage(lang) {
  current = LANGUAGES[lang] ? lang : FALLBACK_LANG;
  document.documentElement.lang = current;
}

export function getLanguage() {
  return current;
}

/** Traduz uma chave. Variáveis: t("temp.lastUpdate", { time: "23:42" }) */
export function t(key, vars) {
  const str = LANGUAGES[current].strings[key] ?? LANGUAGES[FALLBACK_LANG].strings[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

/** Aplica traduções em elementos estáticos do HTML (data-i18n / data-i18n-aria). */
export function translateStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Formata a data conforme a preferência do usuário.
 * format: auto | dmy | mdy | ymd | short | long
 * sep:    "/" | "-" | "."  (vale para os formatos numéricos dmy/mdy; ymd usa sempre "-")
 */
export function formatDate(date, format = "auto", sep = "/") {
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  switch (format) {
    case "dmy": return [d, m, y].join(sep);
    case "mdy": return [m, d, y].join(sep);
    case "ymd": return [y, m, d].join("-");
    case "short": return cleanDots(new Intl.DateTimeFormat(current, { day: "2-digit", month: "short", year: "numeric" }).format(date)).replace(/\bde\b/g, "").replace(/\s+/g, " ").trim();
    case "long": return new Intl.DateTimeFormat(current, { day: "numeric", month: "long", year: "numeric" }).format(date);
    case "auto":
    default: {
      const native = LANGUAGES[current].defaults.dateFormat;
      return formatDate(date, native, sep);
    }
  }
}

/** Dia da semana curto, sem ponto final ("sáb", "Sat"). */
export function formatWeekday(date, style = "short") {
  const s = new Intl.DateTimeFormat(current, { weekday: style }).format(date);
  return cleanDots(s);
}

function cleanDots(s) {
  return s.replace(/\./g, "");
}

/** Hora curta para "última atualização" (respeita 12h/24h do idioma). */
export function formatShortTime(date) {
  return new Intl.DateTimeFormat(current, { hour: "2-digit", minute: "2-digit" }).format(date);
}
