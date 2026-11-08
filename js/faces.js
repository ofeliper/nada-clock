// Motor de mostradores.
// Layout (de cima para baixo): borda [TL TE TR] · espaço · [T] · [L C R] · [B] · espaço · borda [BL BE BR]
// T e B ficam colados no relógio; as bordas ficam nos cantos da tela. Linhas vazias somem.
// O "Minimalista" é um preset fixo; o "Customizado" é montado a partir das configurações.
import * as store from "./store.js";
import { infoLine, createSlotComponent, createClock } from "./components.js";

let mounted = {};
let faceEl;
let currentKey = "";
let clockSlot = "C";

function components(s) {
  if (s.face !== "custom") {
    // Minimalista: relógio no centro + linha de informações acima (padrão) ou abaixo
    clockSlot = "C";
    return { C: createClock(s.clock), [s.infoPosition === "bottom" ? "B" : "T"]: infoLine() };
  }
  const c = s.custom;
  clockSlot = c.clockSlot || "C";
  const out = {};
  for (const id of store.SLOTS) {
    if (id === clockSlot) { out[id] = createClock(s.clock); continue; }
    const comp = createSlotComponent(c.slots[id], id === "C");
    if (comp) out[id] = comp;
  }
  return out;
}

/** Monta o mostrador. Só remonta se algo relevante mudou. */
export function mountFace(face, force = false) {
  faceEl = face;
  const s = store.get();
  const key = JSON.stringify({ f: s.face, clock: s.clock, pos: s.infoPosition, c: s.face === "custom" ? { k: s.custom.clockSlot, sl: s.custom.slots } : 0 });
  if (!force && key === currentKey) return;
  currentKey = key;

  for (const comp of Object.values(mounted)) comp.destroy?.();
  mounted = {};
  const comps = components(s);
  face.querySelectorAll(".slot").forEach((slot) => {
    const id = slot.dataset.slot;
    const comp = comps[id];
    slot.replaceChildren();
    slot.classList.toggle("has-clock", id === clockSlot);
    slot.dataset.type = comp ? (id === clockSlot ? s.clock.type : (s.face === "custom" ? s.custom.slots[id]?.type || "" : "info")) : "";
    if (comp) {
      comp.mount(slot);
      mounted[id] = comp;
    }
  });
  relayout();
}

const used = (id) => mounted[id] && !(mounted[id].isEmpty && mounted[id].isEmpty());

/**
 * Esconde linhas vazias, decide as colunas laterais e calcula a altura máxima do relógio
 * (altura disponível menos as linhas que estão em uso).
 */
export function relayout() {
  if (!faceEl) return;
  const rows = {
    "edge-top": ["TL", "TE", "TR"],
    "near-top": ["T"],
    "near-bottom": ["B"],
    "edge-bottom": ["BL", "BE", "BR"],
  };
  for (const [row, ids] of Object.entries(rows)) {
    const el = faceEl.querySelector(`[data-row="${row}"]`);
    el.hidden = !ids.some(used);
  }
  faceEl.style.setProperty("--col-side", used("L") || used("R") ? "15%" : "0%");

  // altura disponível para o relógio = altura da vista − linhas visíveis
  requestAnimationFrame(() => {
    let taken = 0;
    for (const row of Object.keys(rows)) {
      const el = faceEl.querySelector(`[data-row="${row}"]`);
      if (!el.hidden) taken += el.offsetHeight;
    }
    const avail = Math.max(60, faceEl.clientHeight - taken - 4);
    faceEl.style.setProperty("--clock-max-h", avail + "px");
  });
}

export function updateFace(now = new Date()) {
  for (const comp of Object.values(mounted)) comp.update(now);
}
