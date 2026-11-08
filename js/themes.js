// Paletas de cor. "system" segue o modo claro/escuro do aparelho.
export const THEMES = {
  system:   { bg: null,      fg: null },        // resolvido em tempo real
  terminal: { bg: "#000000", fg: "#33ff66" },
  amber:    { bg: "#000000", fg: "#ffb000" },
  snow:     { bg: "#000000", fg: "#e8e8e8" },
  ice:      { bg: "#000000", fg: "#5ac8fa" },
  night:    { bg: "#000000", fg: "#b3261e" },
  paper:    { bg: "#f4f1ea", fg: "#2b2b2b" },
};

export const THEME_ORDER = ["system", "terminal", "amber", "snow", "ice", "night", "paper"];

// O que "Sistema" escolhe em cada modo do aparelho
export const SYSTEM_DARK = "terminal";
export const SYSTEM_LIGHT = "paper";

const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function systemIsDark() {
  return darkQuery ? darkQuery.matches : true;
}

/** Avisa quando o aparelho troca entre claro e escuro. */
export function onSystemChange(fn) {
  if (!darkQuery) return;
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", fn);
  else if (darkQuery.addListener) darkQuery.addListener(fn); // Safari antigo
}

/** Resolve "system" para uma paleta concreta. */
export function resolveTheme(theme) {
  if (theme === "system" || !THEMES[theme]) return systemIsDark() ? SYSTEM_DARK : SYSTEM_LIGHT;
  return theme;
}
