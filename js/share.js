// Backup (exportar/importar configurações) e compartilhamento de presets por link e QR code.
// Nada passa por servidor: o preset vai codificado no próprio link (depois do "#").
import * as store from "./store.js";
import qrcode from "./vendor/qrcode.js";

const APP_ID = "nada-clock";

// ---------------- Codificação compacta do preset ----------------

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(code) {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Só o que difere do padrão, para o link (e o QR code) ficarem curtos. */
function compact({ custom, clock, theme }, name) {
  const out = { v: 1 };
  if (name) out.n = String(name).slice(0, 40);
  if (theme && theme !== store.DEFAULTS.theme) out.t = theme;
  const k = {};
  for (const [key, val] of Object.entries(clock || {})) if (store.DEFAULT_CLOCK[key] !== val) k[key] = val;
  if (Object.keys(k).length) out.k = k;
  if (custom?.clockSlot && custom.clockSlot !== "C") out.s = custom.clockSlot;
  const l = {};
  for (const [slot, cfg] of Object.entries(custom?.slots || {})) if (cfg && cfg.type && cfg.type !== "empty") l[slot] = cfg;
  out.l = l;
  if (custom?.colors?.enabled) out.c = custom.colors;
  return out;
}

function expandPreset(o) {
  const slots = Object.fromEntries(store.SLOTS.map((s) => [s, { type: "empty" }]));
  for (const [slot, cfg] of Object.entries(o.l || {})) {
    if (store.SLOTS.includes(slot) && cfg && typeof cfg.type === "string") slots[slot] = cfg;
  }
  const clock = { ...store.DEFAULT_CLOCK };
  for (const [key, val] of Object.entries(o.k || {})) if (key in clock && typeof val === typeof clock[key]) clock[key] = val;
  return {
    name: typeof o.n === "string" ? o.n.slice(0, 40) : "",
    data: {
      theme: typeof o.t === "string" ? o.t : store.DEFAULTS.theme,
      clock,
      custom: {
        clockSlot: store.SLOTS.includes(o.s) ? o.s : "C",
        slots,
        colors: o.c && typeof o.c === "object" ? { ...store.DEFAULT_CUSTOM.colors, ...o.c, enabled: true } : { ...store.DEFAULT_CUSTOM.colors },
      },
    },
  };
}

/** Endereço do app (sem a página Sobre e sem "#..."). */
export function appUrl() {
  const path = location.pathname.replace(/(about|sobre|acerca)\/?(index\.html)?$/, "").replace(/index\.html$/, "");
  return location.origin + path;
}

/** Link que abre o app e oferece aplicar o preset. */
export function presetLink(data, name) {
  return `${appUrl()}#p=${toB64Url(JSON.stringify(compact(data, name)))}`;
}

/** Layout atual do Customizado (+ relógio e paleta). */
export function currentLayout() {
  const s = store.get();
  return { custom: s.custom, clock: s.clock, theme: s.theme };
}

/** Lê um preset compartilhado do endereço (#p=...) e limpa o endereço. */
export function readSharedFromUrl() {
  const m = /^#p=([A-Za-z0-9_-]+)$/.exec(location.hash || "");
  if (!m) return null;
  try { history.replaceState(null, "", location.pathname + location.search); } catch { /* ok */ }
  try {
    const o = JSON.parse(fromB64Url(m[1]));
    if (!o || o.v !== 1) return null;
    return expandPreset(o);
  } catch {
    return null;
  }
}

/** Salva o preset recebido e aplica. */
export function applyShared(shared, fallbackName) {
  const s = store.get();
  const preset = {
    id: Date.now().toString(36),
    name: shared.name || fallbackName,
    data: shared.data,
  };
  store.set({ presets: [...s.presets, preset] });
  store.applyPreset(preset.id);
}

/** QR code em SVG (fundo branco, para qualquer câmera ler). */
export function qrSvg(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

/** Compartilha pelo menu do sistema, ou copia o link. Retorna "shared" | "copied" | "failed". */
export async function shareLink(url, title) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return "shared"; }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  return copyText(url);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // reserva para navegadores sem a API de área de transferência
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ok */ }
    ta.remove();
    return ok ? "copied" : "failed";
  }
}

// ---------------- Backup ----------------

/** Gera o arquivo de backup. A localização não vai junto (privacidade). */
export function backupFile() {
  const { location: _loc, ...settings } = store.get();
  const payload = { app: APP_ID, format: 1, exportedAt: new Date().toISOString(), settings };
  const date = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(payload, null, 2)], `nada-clock-backup-${date}.json`, { type: "application/json" });
}

/** Salva o backup: menu de compartilhar (iPhone → "Salvar em Arquivos") ou download. */
export async function exportBackup() {
  const file = backupFile();
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "NADA Clock" });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

/** Lê um arquivo de backup. Lança erro se não for um backup do NADA Clock. */
export async function importBackup(file) {
  const text = await file.text();
  const obj = JSON.parse(text);
  if (!obj || obj.app !== APP_ID || typeof obj.settings !== "object") throw new Error("invalid");
  store.importSettings(obj.settings);
}
