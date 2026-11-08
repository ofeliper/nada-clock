// Sons do relógio, sintetizados na hora (Web Audio) — sem arquivos de áudio.
// No iPhone, os sons seguem a chave de silencioso: no modo silencioso, não tocam.
import * as store from "./store.js";

export const SOUNDS = ["tic", "bip", "chime", "soft", "wood"];

let ctx = null;
let tocToggle = false;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Navegadores só liberam áudio depois de um toque. Chamado em todo toque na tela. */
export function unlock() {
  const c = audio();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function envGain(c, t0, peak, attack, decay) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  return g;
}

function tone(c, out, t0, freq, peak, attack, decay, type = "sine") {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  const g = envGain(c, t0, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + attack + decay + 0.05);
}

function noiseBurst(c, out, t0, freq, q, peak, decay) {
  const len = Math.ceil(c.sampleRate * (decay + 0.02));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = envGain(c, t0, peak, 0.001, decay);
  src.connect(bp).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + decay + 0.03);
}

/** Toca um som. delay em segundos (para repetir toques). */
export function play(name, volume = store.get().sounds.volume, delay = 0) {
  const c = audio();
  if (!c || volume <= 0) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const out = c.createGain();
  out.gain.value = volume;
  out.connect(c.destination);
  const t = c.currentTime + 0.01 + delay;

  switch (name) {
    case "tic": {
      // tic-tac de relógio de parede: alterna dois timbres
      tocToggle = !tocToggle;
      noiseBurst(c, out, t, tocToggle ? 3200 : 2500, 8, 0.9, 0.025);
      tone(c, out, t, tocToggle ? 1900 : 1500, 0.15, 0.001, 0.02, "triangle");
      break;
    }
    case "wood":
      noiseBurst(c, out, t, 900, 5, 0.9, 0.05);
      tone(c, out, t, 640, 0.35, 0.001, 0.06, "triangle");
      break;
    case "bip":
      tone(c, out, t, 1046, 0.45, 0.005, 0.12);
      break;
    case "soft":
      tone(c, out, t, 523, 0.5, 0.01, 0.35);
      tone(c, out, t, 784, 0.2, 0.01, 0.3);
      break;
    case "chime":
    default:
      // sino: fundamental + harmônicos com decaimento longo
      tone(c, out, t, 659, 0.5, 0.005, 1.8);
      tone(c, out, t, 1318, 0.18, 0.005, 1.2);
      tone(c, out, t, 1976, 0.08, 0.005, 0.8);
      break;
  }
}

/**
 * Chamado a cada segundo pelo laço do relógio.
 * Prioridade quando coincidem: hora > personalizado > minuto > segundo.
 */
export function onTick(now, { night = false } = {}) {
  const s = store.get().sounds;
  if (!s.second && !s.minute && !s.hour && !s.custom) return;
  if (document.visibilityState !== "visible") return;
  if (night && s.muteAtNight) return;

  const sec = now.getSeconds();
  const min = now.getMinutes();
  if (sec === 0) {
    if (s.hour && min === 0) {
      const times = s.hourRepeat ? (now.getHours() % 12 || 12) : 1;
      const gap = s.hourSound === "chime" ? 1.1 : 0.45;
      for (let i = 0; i < times; i++) play(s.hourSound, s.volume, i * gap);
      return;
    }
    if (s.custom) {
      const v = Math.max(0, Math.round(Number(s.customValue) || 0));
      const hit = s.customMode === "at" ? min === v % 60 : v > 0 && min % v === 0;
      if (hit) { play(s.customSound, s.volume); return; }
    }
    if (s.minute) { play(s.minuteSound, s.volume); return; }
  }
  if (s.second) play(s.secondSound, s.volume);
}
