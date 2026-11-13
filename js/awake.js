// Tela sempre acesa.
// 1) Wake Lock API (padrão; no iPhone funciona instalado na Tela de Início, iOS 18.4+).
// 2) Reserva: um vídeo minúsculo, preto e mudo, tocando em loop (técnica do NoSleep.js).
//    No iPhone os dois ficam ligados juntos, porque o iOS às vezes solta o Wake Lock
//    sem avisar (ex.: depois de puxar a Central de Controle ou de uma notificação).
// Pede de novo a cada toque, ao voltar para o app e a cada 15 s.
const VIDEO = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAdObW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAud0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAACAAAAAgAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAJfbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAUABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACCm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAcpzdGJsAAAAtnN0c2QAAAAAAAAAAQAAAKZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAIABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALGF2Y0MBQsAe/+EAFWdCwB7ZCWwEQAAAAwBAAAAFA8WLkgEABGjLjLIAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAfQAAADUQAAAAYc3R0cwAAAAAAAAABAAAAFAAABAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAABkc3RzegAAAAAAAAAAAAAAFAAAApMAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAAYHN0Y28AAAAAAAAAFAAAB5MAAAoyAAAKRAAAClYAAApoAAAKegAACowAAAqiAAAKtAAACsYAAArYAAAK6gAACvwAAAsOAAALJAAACzYAAAtIAAALWgAAC2wAAAt+AAADkXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAH0AAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAB9AAAAQAAAEAAAAAAwltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAFYiAACwRFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAK0bWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAJ4c3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAFYiAAAAAAA2ZXNkcwAAAAADgICAJQACAASAgIAXQBUAAAAAAB9AAAADAgWAgIAFE4hW5QAGgICAAQIAAAAUYnRydAAAAAAAAB9AAAADAgAAACBzdHRzAAAAAAAAAAIAAAAsAAAEAAAAAAEAAABEAAAAcHN0c2MAAAAAAAAACAAAAAEAAAABAAAAAQAAAAIAAAADAAAAAQAAAAMAAAACAAAAAQAAAAgAAAADAAAAAQAAAAkAAAACAAAAAQAAAA8AAAADAAAAAQAAABAAAAACAAAAAQAAABUAAAADAAAAAQAAAMhzdHN6AAAAAAAAAAAAAAAtAAAAFQAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAAZHN0Y28AAAAAAAAAFQAAB34AAAomAAAKPAAACk4AAApgAAAKcgAACoQAAAqWAAAKrAAACr4AAArQAAAK4gAACvQAAAsGAAALGAAACy4AAAtAAAALUgAAC2QAAAt2AAALiAAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAAtAAAAAQAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAQebWRhdN4CAExhdmM2MC4zMS4xMDIAAjBADgAAAn4GBf//etxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9YWJyIG1idHJlZT0xIGJpdHJhdGU9OCByYXRldG9sPTEuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA1liIQI8mKAAJVcnXXgARggBwEYIAcBGCAHAAAABkGaOBPlgAEYIAcBGCAHAAAABkGaVAb5YAEYIAcBGCAHAAAABkGaYBPywAEYIAcBGCAHAAAABkGagBXywAEYIAcBGCAHAAAABkGaoBfywAEYIAcBGCAHAAAABkGawBnywAEYIAcBGCAHARggBwAAAAZBmuAa8sABGCAHARggBwAAAAZBmwAa8sABGCAHARggBwAAAAZBmyAa8sABGCAHARggBwAAAAZBm0Aa8sABGCAHARggBwAAAAZBm2Aa8sABGCAHARggBwAAAAZBm4Aa8sABGCAHARggBwAAAAZBm6Aa8sABGCAHARggBwEYIAcAAAAGQZvAGvLAARggBwEYIAcAAAAGQZvgGvLAARggBwEYIAcAAAAGQZoAGvLAARggBwEYIAcAAAAGQZogGvLAARggBwEYIAcAAAAGQZpAGvLAARggBwEYIAcAAAAGQZpgGvLAARggBwEYIAcBGCAH";
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let lock = null;
let video = null;
let videoOn = false;
let onChange = () => {};

/** "on" (Wake Lock), "video" (só a reserva), "off" (ainda não conseguiu; precisa de um toque). */
export function getState() {
  if (lock && !lock.released) return "on";
  if (videoOn) return "video";
  return "off";
}

export function init({ changed } = {}) {
  if (changed) onChange = changed;
  const again = () => ensure();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ensure();
  });
  window.addEventListener("focus", again);
  window.addEventListener("pageshow", again);
  // um toque do usuário destrava o que o navegador não deixou fazer sozinho
  document.addEventListener("pointerup", again, true);
  document.addEventListener("keydown", again, true);
  setInterval(again, 15000);
  ensure();
}

let busy = false;
export async function ensure() {
  if (document.visibilityState !== "visible" || busy) return;
  busy = true;
  const before = getState();
  try {
    if ("wakeLock" in navigator && !(lock && !lock.released)) {
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
          onChange();
          if (document.visibilityState === "visible") setTimeout(ensure, 800);
        });
      } catch {
        lock = null;
      }
    }
    // reserva: sempre no iPhone; nos outros, só se o Wake Lock não deu certo
    const needVideo = IOS || !(lock && !lock.released);
    if (needVideo) await playVideo();
    else stopVideo();
  } finally {
    busy = false;
  }
  if (getState() !== before) onChange();
}

async function playVideo() {
  if (!video) {
    video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("disablepictureinpicture", "");
    video.disableRemotePlayback = true;
    video.muted = true;
    video.loop = true;
    video.src = VIDEO;
    Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "1px", height: "1px", opacity: "0.01", pointerEvents: "none" });
    video.addEventListener("pause", () => { videoOn = false; });
    video.addEventListener("playing", () => { videoOn = true; });
    document.body.appendChild(video);
  }
  if (!video.paused) { videoOn = true; return; }
  try {
    await video.play();
    videoOn = true;
  } catch {
    videoOn = false;   // o navegador pediu um toque antes; tenta de novo no próximo
  }
}

function stopVideo() {
  if (video && !video.paused) video.pause();
  videoOn = false;
}
