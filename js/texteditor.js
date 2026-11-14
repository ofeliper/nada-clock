// Editor de texto "em pé".
// Com o app girado pelo "Forçar horizontal", o teclado do iPhone abre na orientação física
// (de lado em relação ao app). Este editor fica fora do app girado, então aparece na mesma
// orientação do teclado. Também serve para data e cor, cujos seletores nativos têm o mesmo problema.
import { t } from "./i18n.js";
import { TOKEN_GROUPS, expand } from "./tokens.js";

let root, card, titleEl, fieldWrap, previewEl, chipsEl, current = null, timer = null;

const esc = (str) => String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rotated = () => document.documentElement.classList.contains("rot-cw") || document.documentElement.classList.contains("rot-ccw");

export const isOpen = () => !!current;

export function init() {
  root = document.getElementById("text-sheet");
  card = root.querySelector(".ts-card");
  titleEl = root.querySelector(".ts-title");
  fieldWrap = root.querySelector(".ts-field");
  previewEl = root.querySelector(".ts-preview");
  chipsEl = root.querySelector(".ts-chips");

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ts]");
    if (!b) return;
    if (b.dataset.ts === "cancel") close(false);
    else if (b.dataset.ts === "done") close(true);
    else if (b.dataset.ts === "token") insert(b.dataset.value);
  });
  root.addEventListener("mousedown", (e) => { if (e.target.closest(".chip")) e.preventDefault(); });
  root.addEventListener("input", () => paintPreview());
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(false); }
    else if (e.key === "Enter" && current?.kind === "text" && !current.multiline) { e.preventDefault(); close(true); }
  });

  // o teclado diminui a área visível: o editor acompanha
  const vv = window.visualViewport;
  const fit = () => {
    if (!current || !vv) return;
    root.style.top = vv.offsetTop + "px";
    root.style.height = vv.height + "px";
  };
  vv?.addEventListener("resize", fit);
  vv?.addEventListener("scroll", fit);

  // com o app girado, campos de texto, data e cor de dentro do app abrem aqui
  document.addEventListener("focusin", interceptRotated, true);
  document.addEventListener("click", (e) => {
    const el = e.target.closest?.('input[type="date"], input[type="color"], input[type="time"]');
    if (el && rotated() && el.closest("#app")) { e.preventDefault(); interceptRotated({ target: el }); }
  }, true);
}

const TEXT_SEL = 'input[type="text"], input[type="search"], input:not([type]), textarea';

function interceptRotated(e) {
  const el = e.target;
  if (!rotated() || current || !el?.closest?.("#app") || el.closest("#text-sheet")) return;
  let kind = null;
  if (el.matches?.(TEXT_SEL)) kind = "text";
  else if (el.matches?.('input[type="date"]')) kind = "date";
  else if (el.matches?.('input[type="color"]')) kind = "color";
  else if (el.matches?.('input[type="time"]')) kind = "time";
  if (!kind) return;
  el.blur();
  const label = el.closest(".row, .ep-row")?.querySelector(".row-label, .ep-label")?.childNodes[0]?.textContent?.trim()
    || el.getAttribute("aria-label") || el.placeholder || "";
  open({
    kind,
    title: label,
    value: el.value,
    placeholder: el.placeholder,
    tokens: el.hasAttribute("data-tokens"),
    onDone: (v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
}

/**
 * Abre o editor.
 *   kind: "text" | "date" | "color" | "time"
 *   tokens: mostra os botões de variáveis
 *   multiline: permite quebrar linha
 *   preview(text) → texto da prévia (ex.: com as variáveis trocadas); previewStyle: { color, font }
 *   note: aviso curto abaixo do campo
 */
export function open({ kind = "text", title = "", value = "", placeholder = "", tokens = false, multiline = false, preview = null, previewStyle = null, note = "", onDone }) {
  current = { kind, multiline, preview, onDone, initial: value };
  titleEl.textContent = title || t("ts.title");
  let field;
  if (kind === "text" && multiline) field = `<textarea class="ts-input" rows="3" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="sentences" enterkeyhint="enter">${esc(value)}</textarea>`;
  else if (kind === "text") field = `<input class="ts-input" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done">`;
  else field = `<input class="ts-input ts-${kind}" type="${kind}" value="${esc(value)}">`;
  fieldWrap.innerHTML = field + (note ? `<p class="ts-note">${esc(note)}</p>` : "");

  previewEl.hidden = !preview;
  previewEl.className = "ts-preview" + (previewStyle?.font ? " font-" + previewStyle.font : "");
  previewEl.style.color = previewStyle?.color || "";
  chipsEl.hidden = !tokens;
  chipsEl.innerHTML = tokens ? Object.entries(TOKEN_GROUPS).map(([g, list]) => `
    <div class="ts-group"><span class="ts-group-t">${esc(t("cat." + g))}</span>
      <div class="chips">${list.map((tk) => `<button type="button" class="chip" data-ts="token" data-value="{${tk}}" title="${esc(expand(`{${tk}}`))}">{${tk}}</button>`).join("")}</div>
    </div>`).join("") : "";

  root.hidden = false;
  document.documentElement.classList.add("ts-open");
  const vv = window.visualViewport;
  if (vv) { root.style.top = vv.offsetTop + "px"; root.style.height = vv.height + "px"; }
  paintPreview();
  clearInterval(timer);
  if (preview) timer = setInterval(paintPreview, 1000);
  const input = fieldWrap.querySelector(".ts-input");
  requestAnimationFrame(() => {
    root.classList.add("visible");
    input?.focus({ preventScroll: true });
    if (kind === "text") { try { const n = input.value.length; input.setSelectionRange(n, n); } catch { /* ok */ } }
  });
}

function paintPreview() {
  if (!current?.preview) return;
  const v = fieldWrap.querySelector(".ts-input")?.value ?? "";
  previewEl.innerHTML = esc(current.preview(v) || "").replace(/\n/g, "<br>") || "&nbsp;";
}

function insert(tok) {
  const input = fieldWrap.querySelector(".ts-input");
  if (!input) return;
  const s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, s) + tok + input.value.slice(en);
  input.focus({ preventScroll: true });
  try { input.setSelectionRange(s + tok.length, s + tok.length); } catch { /* ok */ }
  paintPreview();
}

export function close(save) {
  if (!current) return;
  const done = current.onDone;
  const v = fieldWrap.querySelector(".ts-input")?.value ?? "";
  const changed = v !== current.initial;
  current = null;
  clearInterval(timer);
  fieldWrap.querySelector(".ts-input")?.blur();
  root.classList.remove("visible");
  document.documentElement.classList.remove("ts-open");
  setTimeout(() => { if (!current) root.hidden = true; }, 180);
  if (save && changed) done?.(v);
}
