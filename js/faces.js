// Motor de mostradores: uma grade 3x3 onde cada slot recebe um componente (ou fica vazio).
// O "Minimalista" é só um preset fixo deste motor; o "Customizado" vai reutilizá-lo.
import * as store from "./store.js";
import { formatDate, formatWeekday, getLanguage, LANGUAGES } from "./i18n.js";
import { formatTemp } from "./weather.js";

const SIDE_SIZE = "15%";
const ROW_SLOTS = ["TL", "T", "TR", "BL", "B", "BR"];
const COL_SLOTS = ["TL", "L", "BL", "TR", "R", "BR"];

const pad = (n) => String(n).padStart(2, "0");

// ---------------- Componentes ----------------

/** Relógio digital HH:MM:SS. Opções pensando no Customizado: hour12, seconds. */
function clockDigital(opts = {}) {
  const { hour12 = false, seconds = true } = opts;
  let els;
  return {
    mount(el) {
      el.innerHTML = `<div class="clock-digital" role="timer">
        <span class="hh"></span><span class="sep">:</span><span class="mm"></span>${seconds ? '<span class="sep">:</span><span class="ss"></span>' : ""}
      </div>`;
      els = {
        hh: el.querySelector(".hh"),
        mm: el.querySelector(".mm"),
        ss: el.querySelector(".ss"),
      };
    },
    update(now) {
      let h = now.getHours();
      if (hour12) h = h % 12 || 12;
      els.hh.textContent = pad(h);
      els.mm.textContent = pad(now.getMinutes());
      if (els.ss) els.ss.textContent = pad(now.getSeconds());
    },
  };
}

/** Linha discreta: dia da semana · data · temperatura. */
function infoLine() {
  let el;
  let last = "";
  return {
    mount(target) {
      el = document.createElement("div");
      el.className = "info-line";
      target.replaceChildren(el);
      last = "";
    },
    update(now) {
      const s = store.get();
      const parts = [];
      if (s.showWeekday) parts.push(formatWeekday(now));
      if (s.showDate) parts.push(formatDate(now, s.dateFormat, s.dateSeparator));
      if (s.tempEnabled) {
        const w = store.getWeatherCache();
        if (w?.tempC != null) {
          const unit = s.tempUnit || LANGUAGES[getLanguage()].defaults.tempUnit;
          parts.push(formatTemp(w.tempC, unit));
        }
      }
      const html = parts.map(escapeHTML).join('<span class="dot">·</span>');
      if (html !== last) {
        el.innerHTML = html;
        last = html;
      }
    },
    isEmpty() {
      const s = store.get();
      return !s.showWeekday && !s.showDate && !s.tempEnabled;
    },
  };
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------- Presets ----------------

export const FACES = {
  minimal: () => ({
    C: clockDigital({ hour12: false, seconds: true }),
    B: infoLine(),
  }),
};

// ---------------- Motor ----------------

let mounted = {};
let gridEl;

export function mountFace(name, grid) {
  gridEl = grid;
  const factory = FACES[name] || FACES.minimal;
  const components = factory();
  mounted = {};
  grid.querySelectorAll(".slot").forEach((slot) => {
    const id = slot.dataset.slot;
    const comp = components[id];
    slot.replaceChildren();
    if (comp) {
      comp.mount(slot);
      mounted[id] = comp;
    }
  });
  relayout();
}

/** Recolhe linhas/colunas laterais sem conteúdo, para o centro "ganhar" espaço.
 *  É simétrico (topo+base, esquerda+direita) para o relógio continuar centralizado. */
export function relayout() {
  if (!gridEl) return;
  const used = (id) => mounted[id] && !(mounted[id].isEmpty && mounted[id].isEmpty());
  const rowsUsed = ROW_SLOTS.some(used);
  const colsUsed = COL_SLOTS.some(used);
  gridEl.style.setProperty("--row-side", rowsUsed ? SIDE_SIZE : "0%");
  gridEl.style.setProperty("--col-side", colsUsed ? SIDE_SIZE : "0%");
}

export function updateFace(now = new Date()) {
  for (const comp of Object.values(mounted)) comp.update(now);
}
