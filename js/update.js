// Atualizações do app (service worker).
// - Procura versão nova ao abrir e ao voltar para o app (no máximo a cada 30 min).
// - Quando uma versão nova assume, mostra um aviso para recarregar.
// - Botão nas configurações: procurar agora / forçar recarregamento.
import { t } from "./i18n.js";

const AUTO_CHECK_MS = 30 * 60 * 1000;
let reg = null;
let lastCheck = 0;
let hadController = false;
let reloading = false;

export const supported = "serviceWorker" in navigator && location.protocol === "https:";

const FLAG = "nada-clock:updated";
const VEIL_MS = 420;
let toastTimer = null;

export async function init({ version } = {}) {
  welcomeBack(version);
  if (!supported) return;
  hadController = !!navigator.serviceWorker.controller;
  try {
    reg = await navigator.serviceWorker.register("./sw.js");
  } catch {
    return;
  }
  // uma versão nova assumiu o controle: oferece recarregar
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) { smoothReload(); return; }
    if (hadController) showToast();
    hadController = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastCheck > AUTO_CHECK_MS) check().catch(() => {});
  });
  lastCheck = Date.now();
}

function check() {
  lastCheck = Date.now();
  return reg ? reg.update() : Promise.resolve();
}

function waitForActivation(worker, timeout = 15000) {
  return new Promise((resolve) => {
    if (worker.state === "activated") return resolve(true);
    const done = () => { if (worker.state === "activated" || worker.state === "redundant") { worker.removeEventListener("statechange", done); resolve(worker.state === "activated"); } };
    worker.addEventListener("statechange", done);
    setTimeout(() => resolve(false), timeout);
  });
}

/**
 * Procura uma versão nova agora.
 * Retorna: "updating" (vai recarregar), "latest", "unsupported" ou "error".
 */
export async function checkNow() {
  if (!supported) return "unsupported";
  if (!reg) {
    try { reg = await navigator.serviceWorker.getRegistration(); } catch { /* ok */ }
    if (!reg) return "unsupported";
  }
  try {
    await check();
    const w = reg.installing || reg.waiting;
    if (!w) return "latest";
    reloading = true;
    const ok = await waitForActivation(w);
    // a recarga acontece no "controllerchange" (com a tela escurecendo suavemente);
    // se ele não vier, recarrega mesmo assim
    if (ok) setTimeout(() => smoothReload(), 1500);
    return ok ? "updating" : "error";
  } catch {
    return "error";
  }
}

/** Apaga o cache do app e recarrega do servidor. */
export async function forceReload() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("nada-clock")).map((k) => caches.delete(k)));
  } catch { /* ok */ }
  try { await reg?.unregister(); } catch { /* ok */ }
  smoothReload();
}

/**
 * Recarrega sem tranco: a tela escurece com "Atualizando…" e, na volta,
 * clareia e mostra "Atualizado para a versão X".
 */
let reloadStarted = false;
export function smoothReload() {
  if (reloadStarted) return;
  reloadStarted = true;
  try { sessionStorage.setItem(FLAG, "1"); } catch { /* ok */ }
  const veil = document.getElementById("reload-veil");
  if (veil) {
    veil.querySelector(".veil-text").textContent = t("update.updating");
    veil.hidden = false;
    requestAnimationFrame(() => veil.classList.add("on"));
  }
  setTimeout(() => location.reload(), veil ? VEIL_MS : 0);
}

/** Depois de atualizar: tira o véu escuro com fade e confirma a versão. */
function welcomeBack(version) {
  let updated = false;
  try { updated = sessionStorage.getItem(FLAG) === "1"; sessionStorage.removeItem(FLAG); } catch { /* ok */ }
  const veil = document.getElementById("reload-veil");
  if (!updated) { document.documentElement.classList.remove("veil-boot"); return; }
  if (veil) {
    veil.hidden = false;
    veil.classList.add("on");
    veil.querySelector(".veil-text").textContent = "";
    document.documentElement.classList.remove("veil-boot");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      veil.classList.remove("on");
      setTimeout(() => { veil.hidden = true; }, VEIL_MS + 50);
    }));
  }
  const el = document.getElementById("update-toast");
  if (!el || !version) return;
  el.className = "toast toast-ok";
  el.innerHTML = `<span>${escHtml(t("update.done", { v: version }))}</span>`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Aviso de versão nova. Tocar inicia uma contagem (3, 2, 1) com "Agora" e "Cancelar". */
export function showToast() {
  const el = document.getElementById("update-toast");
  if (!el) return;
  el.className = "toast";
  el.innerHTML = `<button type="button" class="toast-main" data-u="start">${escHtml(t("update.toast"))}</button>`;
  el.hidden = false;
  el.onclick = (e) => {
    const b = e.target.closest("[data-u]");
    if (!b) return;
    if (b.dataset.u === "start") countdown(el);
    else if (b.dataset.u === "now") { clearInterval(toastTimer); smoothReload(); }
    else if (b.dataset.u === "cancel") { clearInterval(toastTimer); showToast(); }
  };
}

function countdown(el) {
  let n = 3;
  const paint = () => {
    el.innerHTML = `<span class="toast-count">${escHtml(t("update.countdown", { n }))}</span>`
      + `<button type="button" class="toast-btn" data-u="now">${escHtml(t("update.now"))}</button>`
      + `<button type="button" class="toast-btn ghost" data-u="cancel">${escHtml(t("update.cancel"))}</button>`;
  };
  paint();
  clearInterval(toastTimer);
  toastTimer = setInterval(() => {
    n -= 1;
    if (n <= 0) { clearInterval(toastTimer); smoothReload(); return; }
    paint();
  }, 1000);
}
