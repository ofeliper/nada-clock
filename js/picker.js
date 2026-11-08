// Seletor próprio: uma lista desenhada dentro do app.
// Substitui a "roleta" nativa do <select>, que abre sempre na orientação física do aparelho
// (e fica de lado quando o app está girado para a horizontal).
let root, titleEl, listEl, onPick = null, lastFocus = null;

export function initPicker() {
  root = document.getElementById("picker");
  titleEl = root.querySelector(".picker-title");
  listEl = root.querySelector(".picker-list");
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-picker-close]")) { close(); return; }
    const opt = e.target.closest("[data-value]");
    if (opt) {
      const v = opt.dataset.value;
      const cb = onPick;
      close();
      cb?.(v);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!root.hidden && e.key === "Escape") { e.stopPropagation(); close(); }
  }, true);
}

export function openPicker({ title = "", options = [], value, onSelect }) {
  lastFocus = document.activeElement;
  onPick = onSelect;
  titleEl.textContent = title;
  titleEl.hidden = !title;
  listEl.innerHTML = options.map((o) => `
    <button type="button" class="picker-opt" role="option" data-value="${esc(o.value)}" aria-selected="${String(o.value) === String(value)}">
      <span>${esc(o.label)}</span><span class="check" aria-hidden="true">✓</span>
    </button>`).join("");
  root.hidden = false;
  const sel = listEl.querySelector('[aria-selected="true"]') || listEl.querySelector(".picker-opt");
  if (sel) { sel.scrollIntoView({ block: "center" }); sel.focus({ preventScroll: true }); }
}

export function close() {
  root.hidden = true;
  onPick = null;
  try { lastFocus?.focus?.({ preventScroll: true }); } catch { /* ok */ }
}

/** Liga todos os <select> dentro de container ao seletor próprio. */
export function enhanceSelects(container) {
  container.querySelectorAll("select").forEach((sel) => {
    if (sel.parentElement?.classList.contains("select-wrap")) return;
    const wrap = document.createElement("span");
    wrap.className = "select-wrap";
    sel.replaceWith(wrap);
    wrap.appendChild(sel);
  });
}

/** Trata o toque num select embrulhado. Retorna true se abriu o seletor. */
export function handleSelectTap(e) {
  const wrap = e.target.closest(".select-wrap");
  if (!wrap) return false;
  const sel = wrap.querySelector("select");
  if (!sel || sel.disabled) return false;
  e.preventDefault();
  const row = wrap.closest(".row");
  const label = row?.querySelector(".row-label")?.childNodes[0]?.textContent?.trim() || "";
  openPicker({
    title: label,
    options: [...sel.options].map((o) => ({ value: o.value, label: o.textContent })),
    value: sel.value,
    onSelect: (v) => {
      if (sel.value === v) return;
      sel.value = v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  return true;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
