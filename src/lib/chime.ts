// Aviso sonoro de pago nuevo, sintetizado con Web Audio (sin archivos).
// Los navegadores no dejan reproducir audio hasta que el usuario interactúa
// con la página: unlockAudio() se llama en el primer click o tecla.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // Sin Web Audio: el aviso queda solo visual.
  }
}

/** Dos notas ascendentes cortas. Devuelve false si el audio sigue bloqueado. */
export function playChime(): boolean {
  if (!ctx || ctx.state !== "running") return false;

  const start = ctx.currentTime;
  [880, 1318.5].forEach((frequency, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    const t = start + i * 0.15;

    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
  return true;
}
