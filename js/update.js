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

export async function init() {
  if (!supported) return;
  hadController = !!navigator.serviceWorker.controller;
  try {
    reg = await navigator.serviceWorker.register("./sw.js");
  } catch {
    return;
  }
  // uma versão nova assumiu o controle: oferece recarregar
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) { location.reload(); return; }
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
    if (ok) setTimeout(() => location.reload(), 300);
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
  location.reload();
}

function showToast() {
  const el = document.getElementById("update-toast");
  if (!el) return;
  el.textContent = t("update.toast");
  el.hidden = false;
  el.onclick = () => location.reload();
}
