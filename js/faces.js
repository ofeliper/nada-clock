// Motor de mostradores: uma grade 3x3 onde cada slot recebe um componente (ou fica vazio).
// O "Minimalista" é um preset fixo; o "Customizado" é montado a partir das configurações.
import * as store from "./store.js";
import { clockDigital, infoLine, createSlotComponent, createCenterComponent } from "./components.js";

const SIDE_SIZE = "15%";
const ROW_SLOTS = ["TL", "T", "TR", "BL", "B", "BR"];
const COL_SLOTS = ["TL", "L", "BL", "TR", "R", "BR"];

const FACES = {
  minimal: () => ({
    C: clockDigital({ hour12: false, seconds: true, font: "rounded" }),
    B: infoLine(),
  }),
  custom: () => {
    const c = store.get().custom;
    const out = { C: createCenterComponent(c.center) };
    for (const [slot, cfg] of Object.entries(c.slots)) {
      if (slot === "C") continue;
      const comp = createSlotComponent(cfg);
      if (comp) out[slot] = comp;
    }
    return out;
  },
};

let mounted = {};
let gridEl;
let currentKey = "";

/** Monta o mostrador. Só remonta se algo relevante mudou. */
export function mountFace(grid, force = false) {
  gridEl = grid;
  const s = store.get();
  const key = s.face === "custom" ? "custom:" + JSON.stringify({ center: s.custom.center, slots: s.custom.slots }) : "minimal";
  if (!force && key === currentKey) return;
  currentKey = key;

  const factory = FACES[s.face] || FACES.minimal;
  const components = factory();
  for (const comp of Object.values(mounted)) comp.destroy?.();
  mounted = {};
  grid.querySelectorAll(".slot").forEach((slot) => {
    const id = slot.dataset.slot;
    const comp = components[id];
    slot.replaceChildren();
    let type = "";
    if (comp && s.face === "custom") type = id === "C" ? s.custom.center.type : (s.custom.slots[id]?.type || "");
    else if (comp) type = id === "C" ? "digital" : "info";
    slot.dataset.type = type;
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
