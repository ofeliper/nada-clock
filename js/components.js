// Componentes que podem ocupar os slots da grade 3x3.
// Cada componente: { mount(el), update(now), isEmpty?() }
import * as store from "./store.js";
import { t, formatDate, formatWeekday, getLanguage } from "./i18n.js";
import { expand, tempWithCondition, weatherExtra, weatherData } from "./tokens.js";
import { conditionIcon } from "./weather.js";

const pad = (n) => String(n).padStart(2, "0");
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SVG_NS = "http://www.w3.org/2000/svg";

/** Helper para componentes que são só uma linha de texto. */
function textComponent(render, { className = "comp-text" } = {}) {
  let el;
  let last = null;
  return {
    mount(target) {
      el = document.createElement("div");
      el.className = className;
      target.replaceChildren(el);
      last = null;
    },
    update(now) {
      const html = render(now);
      if (html !== last) { el.innerHTML = html; last = html; }
    },
    isEmpty() {
      return render(new Date()) === "";
    },
  };
}

// ---------------- Relógio digital ----------------
// Estilos: fonte normal, "led" (7 segmentos desenhados em SVG) e "flip" (plaquinhas que viram).
const SEG_SHAPES = {
  a: "10,2 50,2 55,7 50,12 10,12 5,7",
  b: "48,10 53,5 58,10 58,43 53,48 48,43",
  c: "48,57 53,52 58,57 58,90 53,95 48,90",
  d: "10,88 50,88 55,93 50,98 10,98 5,93",
  e: "2,57 7,52 12,57 12,90 7,95 2,90",
  f: "2,10 7,5 12,10 12,43 7,48 2,43",
  g: "10,45 50,45 55,50 50,55 10,55 5,50",
};
const SEG_ON = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];

export function ledDigit(d) {
  const on = SEG_ON[Number(d)] || "";
  return `<svg class="led" viewBox="0 0 60 100" aria-hidden="true">${
    Object.entries(SEG_SHAPES).map(([k, pts]) => `<polygon points="${pts}" class="${on.includes(k) ? "on" : "off"}"/>`).join("")
  }</svg>`;
}
const LED_COLON = '<svg class="led led-colon" viewBox="0 0 20 100" aria-hidden="true"><rect x="4" y="26" width="12" height="12" rx="2" class="on"/><rect x="4" y="62" width="12" height="12" rx="2" class="on"/></svg>';

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function clockDigital(opts = {}) {
  const { hour12 = false, seconds = true, blink = false, font = "thin", flip = false } = opts;
  const led = font === "led";
  let cells = [], seps, ampm, timerEl, lastLabel = "";

  const paint = (cell, ch) => { cell.innerHTML = led ? ledDigit(ch) : ch; };

  function setDigit(cell, ch) {
    if (cell.dataset.v === ch) return;
    const first = cell.dataset.v == null;
    cell.dataset.v = ch;
    if (!flip || first || reduceMotion() || !cell.animate) { paint(cell, ch); return; }
    // plaquinha: vira até a metade, troca o número, termina de virar
    const out = cell.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }], { duration: 140, easing: "ease-in" });
    out.onfinish = () => {
      paint(cell, cell.dataset.v);
      cell.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], { duration: 160, easing: "ease-out" });
    };
  }

  return {
    mount(el) {
      const size = seconds ? (hour12 ? "size-hms-ampm" : "size-hms") : (hour12 ? "size-hm-ampm" : "size-hm");
      const group = (cls) => `<span class="grp ${cls}"><span class="dg"></span><span class="dg"></span></span>`;
      const sep = `<span class="sep">${led ? LED_COLON : ":"}</span>`;
      el.innerHTML = `<div class="clock-digital font-${font} ${size} ${flip ? "flip" : ""}" role="timer" aria-live="off">`
        + group("hh") + sep + group("mm")
        + (seconds ? sep + group("ss") : "")
        + (hour12 ? `<span class="ampm"></span>` : "")
        + `</div>`;
      timerEl = el.querySelector(".clock-digital");
      cells = [...el.querySelectorAll(".dg")];
      seps = el.querySelectorAll(".sep");
      ampm = el.querySelector(".ampm");
      lastLabel = "";
    },
    update(now) {
      let h = now.getHours();
      if (hour12) {
        ampm.textContent = h < 12 ? "AM" : "PM";
        h = h % 12 || 12;
      }
      const str = pad(h) + pad(now.getMinutes()) + (seconds ? pad(now.getSeconds()) : "");
      for (let i = 0; i < cells.length; i++) setDigit(cells[i], str[i]);
      if (blink) {
        const dim = now.getSeconds() % 2 === 1;
        seps.forEach((s) => s.classList.toggle("dim", dim));
      }
      // leitores de tela: rótulo atualizado por minuto (não a cada segundo)
      const label = `${pad(h)}:${pad(now.getMinutes())}${hour12 ? " " + ampm.textContent : ""}`;
      if (label !== lastLabel) { timerEl.setAttribute("aria-label", label); lastLabel = label; }
    },
  };
}

// ---------------- Relógio analógico ----------------
export function clockAnalog(opts = {}) {
  const { seconds = true, smooth = false, hourNumbers = false, minuteNumbers = false, minuteTicks = false } = opts;
  let hHand, mHand, sHand, raf = 0;

  // Geometria: com números dos minutos, as marcas encolhem para abrir espaço
  const tickOuter = minuteNumbers ? 76 : 86;      // raio externo das marcas
  const tickInner = minuteNumbers ? 70 : 72;
  const tickMajorInner = minuteNumbers ? 66 : 70;
  const hourR = minuteNumbers ? 54 : 58;          // raio dos números das horas

  const polar = (r, deg) => {
    const a = (deg - 90) * Math.PI / 180;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
  };

  function setHands(ms) {
    const d = new Date(ms);
    const sec = d.getSeconds() + (smooth ? d.getMilliseconds() / 1000 : 0);
    const m = d.getMinutes() + sec / 60;
    const h = (d.getHours() % 12) + m / 60;
    hHand.setAttribute("transform", `rotate(${h * 30} 100 100)`);
    mHand.setAttribute("transform", `rotate(${m * 6} 100 100)`);
    if (sHand) sHand.setAttribute("transform", `rotate(${sec * 6} 100 100)`);
  }

  function frame() {
    setHands(Date.now());
    raf = requestAnimationFrame(frame);
  }

  return {
    mount(el) {
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const major = i % 3 === 0;
        return `<line x1="100" y1="${100 - tickOuter}" x2="100" y2="${100 - (major ? tickMajorInner : tickInner)}" stroke-width="${major ? 4 : 2.5}" transform="rotate(${i * 30} 100 100)"/>`;
      }).join("");
      const minorTicks = minuteTicks ? Array.from({ length: 60 }, (_, i) => i % 5 === 0 ? "" :
        `<line x1="100" y1="${100 - tickOuter}" x2="100" y2="${100 - tickOuter + 4}" stroke-width="1.2" transform="rotate(${i * 6} 100 100)"/>`).join("") : "";
      const hourNums = hourNumbers ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const [x, y] = polar(hourR, n * 30);
        return `<text class="num num-h" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${n}</text>`;
      }).join("") : "";
      const minuteNums = minuteNumbers ? Array.from({ length: 12 }, (_, i) => {
        const n = (i + 1) * 5;
        const [x, y] = polar(86, n * 6);
        return `<text class="num num-m" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${String(n).padStart(2, "0")}</text>`;
      }).join("") : "";
      el.innerHTML = `
        <svg class="clock-analog" viewBox="0 0 200 200" role="img" aria-label="clock">
          <circle class="face" cx="100" cy="100" r="96"/>
          <g class="ticks">${ticks}</g>
          ${minorTicks ? `<g class="ticks minor">${minorTicks}</g>` : ""}
          ${hourNums}${minuteNums}
          <line class="hand hand-h" x1="100" y1="112" x2="100" y2="${hourNumbers ? 64 : 52}"/>
          <line class="hand hand-m" x1="100" y1="116" x2="100" y2="${minuteNumbers ? 34 : 30}"/>
          ${seconds ? `<line class="hand hand-s" x1="100" y1="122" x2="100" y2="${minuteNumbers ? 28 : 22}"/>` : ""}
          <circle class="hub" cx="100" cy="100" r="5"/>
        </svg>`;
      hHand = el.querySelector(".hand-h");
      mHand = el.querySelector(".hand-m");
      sHand = el.querySelector(".hand-s");
      if (smooth && seconds) raf = requestAnimationFrame(frame);
    },
    update(now) {
      if (!raf) setHands(now.getTime() - now.getMilliseconds());
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

// ---------------- Linha de informações (Minimalista) ----------------
export function infoLine() {
  const render = (now) => {
    const s = store.get();
    const parts = [];
    if (s.showWeekday) parts.push(formatWeekday(now));
    if (s.showDate) parts.push(formatDate(now, s.dateFormat, s.dateSeparator));
    const html = parts.map(esc);
    const temp = tempWithCondition(s.tempCondition);
    if (temp) html.push(`<span class="nw">${iconFor(s.tempIcon)}${esc(temp)}</span>`);
    return html.join('<span class="dot">·</span>');
  };
  const comp = textComponent(render, { className: "info-line" });
  comp.isEmpty = () => { const s = store.get(); return !s.showWeekday && !s.showDate && !s.tempEnabled; };
  return comp;
}

// ---------------- Componentes de texto ----------------
export const weekday = () => textComponent((now) => esc(formatWeekday(now, "long")));

export const date = () => textComponent((now) => {
  const s = store.get();
  return esc(formatDate(now, s.dateFormat, s.dateSeparator));
});

export const weekdayDate = () => textComponent((now) => {
  const s = store.get();
  return `${esc(formatWeekday(now))}<span class="dot">·</span>${esc(formatDate(now, s.dateFormat, s.dateSeparator))}`;
});

/** Temperatura + extras opcionais (condição, sensação, mín/máx, umidade, chuva, vento). */
export const WEATHER_EXTRAS = ["feels", "minmax", "humidity", "rain", "wind"];
export const temperature = (opts = {}) => textComponent(() => {
  const main = tempWithCondition(opts.condition !== false);
  if (!main) return "";
  const extras = WEATHER_EXTRAS.filter((k) => opts[k]).map((k) => weatherExtra(k)).filter(Boolean);
  return `<span class="nw">${iconFor(opts.icon !== false)}${esc(main)}</span>` + extras.map((x) => '<span class="dot">·</span>' + esc(x)).join("");
});

function iconFor(enabled) {
  if (!enabled) return "";
  const w = weatherData();
  return w ? conditionIcon(w.code, w.isDay) : "";
}

export const freeText = (opts = {}, big = false) =>
  textComponent((now) => esc(expand(opts.text || "", now)), { className: big ? "comp-text comp-text-big" : "comp-text" });

// ---------------- Segundo fuso horário ----------------
export const ZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Mexico_City", "America/Buenos_Aires", "Europe/Lisbon", "Europe/London",
  "Europe/Madrid", "Europe/Paris", "Europe/Berlin", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "UTC",
];

export const zoneCity = (zone) => (zone === "UTC" ? "UTC" : zone.split("/").pop().replace(/_/g, " "));

export function timezone(opts = {}) {
  const zone = opts.zone || "Europe/Lisbon";
  const hour12 = !!store.get().clock.hour12;
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12 });
  } catch {
    fmt = null;
  }
  return textComponent((now) => {
    if (!fmt) return "";
    const label = opts.label?.trim() || zoneCity(zone);
    return `${esc(label)} <span class="strong">${esc(fmt.format(now).toUpperCase())}</span>`;
  });
}

// ---------------- Progresso (dia / semana / mês / ano) ----------------
export function progress(opts = {}) {
  const mode = opts.mode || "day";
  let fill, label, last = -1;
  const ratio = (now) => {
    const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
    let start, end;
    if (mode === "year") { start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1); }
    else if (mode === "month") { start = new Date(y, mo, 1); end = new Date(y, mo + 1, 1); }
    else if (mode === "week") {
      const dow = (now.getDay() + 6) % 7; // segunda = 0
      start = new Date(y, mo, d - dow); end = new Date(y, mo, d - dow + 7);
    } else { start = new Date(y, mo, d); end = new Date(y, mo, d + 1); }
    return (now - start) / (end - start);
  };
  return {
    mount(el) {
      el.innerHTML = `<div class="comp-progress"><span class="p-label"></span><span class="p-bar"><span class="p-fill"></span></span></div>`;
      fill = el.querySelector(".p-fill");
      label = el.querySelector(".p-label");
      last = -1;
    },
    update(now) {
      const pct = Math.floor(ratio(now) * 100);
      if (pct === last) return;
      last = pct;
      fill.style.width = pct + "%";
      label.textContent = `${t("progress." + mode)} ${pct}%`;
    },
  };
}

// ---------------- Fase da lua ----------------
const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // lua nova de referência

export function moonPhase(now) {
  const days = (now.getTime() - KNOWN_NEW_MOON) / 86400000;
  return (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC; // 0 = nova, 0.5 = cheia
}

function phaseName(p) {
  const idx = Math.round(p * 8) % 8;
  return t("moon." + ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"][idx]);
}

function southern(opts) {
  if (opts.hemisphere === "north") return false;
  if (opts.hemisphere === "south") return true;
  const lat = store.get().location?.lat;
  if (typeof lat === "number") return lat < 0;
  return getLanguage() === "pt-BR";
}

export function moon(opts = {}) {
  let svgPath, svgG, label, lastKey = "";
  return {
    mount(el) {
      el.innerHTML = `<div class="comp-moon">
        <svg viewBox="-12 -12 24 24" class="moon-icon" aria-hidden="true">
          <circle r="10" class="moon-dark"/><g><path class="moon-lit"/></g>
        </svg><span class="moon-label"></span></div>`;
      svgPath = el.querySelector(".moon-lit");
      svgG = el.querySelector("g");
      label = el.querySelector(".moon-label");
      lastKey = "";
    },
    update(now) {
      const p = moonPhase(now);
      const key = p.toFixed(3) + (opts.showName === false ? "0" : "1");
      if (key === lastKey) return;
      lastKey = key;
      const r = 10;
      const f = (1 - Math.cos(2 * Math.PI * p)) / 2;          // fração iluminada
      const rx = r * Math.abs(Math.cos(2 * Math.PI * p));
      const sweep = f < 0.5 ? 0 : 1;
      svgPath.setAttribute("d", `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`);
      let rightLit = p < 0.5;              // crescente: lado direito (hemisfério norte)
      if (southern(opts)) rightLit = !rightLit;
      svgG.setAttribute("transform", rightLit ? "" : "scale(-1 1)");
      label.textContent = opts.showName === false ? "" : phaseName(p);
    },
  };
}

// ---------------- Contagem até uma data ----------------
export function countdown(opts = {}) {
  return textComponent((now) => {
    if (!opts.date) return "";
    const [y, m, d] = opts.date.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((target - today) / 86400000);
    const name = opts.label?.trim() ? esc(opts.label.trim()) : "";
    let txt;
    if (diff === 0) txt = t("countdown.today");
    else if (diff > 0) txt = t(diff === 1 ? "countdown.day" : "countdown.days", { n: diff });
    else txt = t("countdown.ago", { n: -diff });
    return name ? `${esc(txt)}<span class="dot">·</span>${name}` : esc(txt);
  });
}

// ---------------- Nascer e pôr do sol ----------------
// Calculado localmente (equação do nascer do sol / NOAA simplificada) a partir da localização.
const RAD = Math.PI / 180;

export function sunTimes(date, lat, lon) {
  // dia juliano do meio-dia UTC da data do calendário local
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  if (cosW > 1) return { polar: "night" };
  if (cosW < -1) return { polar: "day" };
  const w = Math.acos(cosW) / RAD;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { rise: toDate(jTransit - w / 360), set: toDate(jTransit + w / 360) };
}

const SUN_UP = '<svg class="sun-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 4l2.5 2.5"/></svg>';
const SUN_DOWN = '<svg class="sun-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 9V4M9.5 6.5 12 9l2.5-2.5"/></svg>';

export function sun() {
  let cacheKey = "", cacheHtml = "";
  return textComponent((now) => {
    const loc = store.get().location;
    if (typeof loc?.lat !== "number") return "";
    const key = `${now.toDateString()}|${loc.lat}|${loc.lon}|${store.get().clock.hour12}`;
    if (key === cacheKey) return cacheHtml;
    cacheKey = key;
    const st = sunTimes(now, loc.lat, loc.lon);
    const h12 = !!store.get().clock.hour12;
    const fmt = (d) => d.toLocaleTimeString(h12 ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit", hour12: h12 });
    cacheHtml = st.polar ? esc(t(st.polar === "day" ? "sun.polarDay" : "sun.polarNight"))
      : `<span class="sun">${SUN_UP}${esc(fmt(st.rise))}</span><span class="dot">·</span><span class="sun">${SUN_DOWN}${esc(fmt(st.set))}</span>`;
    return cacheHtml;
  });
}

// ---------------- Catálogo ----------------
/** Componentes disponíveis para as posições (ordem = ordem no editor). */
export const SLOT_TYPES = ["empty", "weekdayDate", "weekday", "date", "temperature", "timezone", "progress", "moon", "sun", "countdown", "text"];

export function createSlotComponent(cfg = {}) {
  switch (cfg?.type) {
    case "weekdayDate": return weekdayDate();
    case "weekday": return weekday();
    case "date": return date();
    case "temperature": return temperature(cfg);
    case "timezone": return timezone(cfg);
    case "progress": return progress(cfg);
    case "moon": return moon(cfg);
    case "sun": return sun();
    case "countdown": return countdown(cfg);
    case "text": return freeText(cfg);
    default: return null;
  }
}

/** Relógio (digital ou analógico) com as opções compartilhadas. */
export function createClock(c = {}) {
  if (c.type === "analog") return clockAnalog({
    seconds: c.analogSeconds, smooth: c.analogSmooth,
    hourNumbers: c.analogHourNumbers, minuteNumbers: c.analogMinuteNumbers, minuteTicks: c.analogMinuteTicks,
  });
  return clockDigital(c);
}
