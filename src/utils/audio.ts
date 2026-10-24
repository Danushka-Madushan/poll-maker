/**
 * Spooky Web Audio API sound synthesizer.
 * Host mute state is respected — call setMuted(true) to silence.
 *
 * Sounds synthesized entirely via Web Audio (no external files needed):
 *   - creak: low-pitched filtered noise for the reveal lead-in
 *   - sting: winner fanfare (bright sine sweep)
 *   - tick:  short click/tap for countdown
 *   - tap:   UI interaction click
 */

let ctx: AudioContext | null = null;
let muted = true; // off by default per design guide §5.7

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  return muted;
}

/** Reveal creak — low rumble */
export function playCreak(): void {
  if (muted) return;
  const ac = getCtx();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.8, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ac.currentTime);
  filter.frequency.linearRampToValueAtTime(80, ac.currentTime + 0.8);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.3, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start();
}

/** Winner sting — bright ascending sweep */
export function playSting(): void {
  if (muted) return;
  const ac = getCtx();

  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();

  osc1.type = 'square';
  osc1.frequency.setValueAtTime(220, ac.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.4);

  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(110, ac.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.4);

  gain.gain.setValueAtTime(0.2, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.4, ac.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ac.destination);

  osc1.start(ac.currentTime);
  osc2.start(ac.currentTime);
  osc1.stop(ac.currentTime + 0.8);
  osc2.stop(ac.currentTime + 0.8);
}

/** Countdown tick */
export function playTick(): void {
  if (muted) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ac.currentTime);

  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.05);
}

/** Short UI tap click */
export function playTap(): void {
  if (muted) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, ac.currentTime);

  gain.gain.setValueAtTime(0.08, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.08);
}

/** Unlock audio context (call on first user interaction) */
export function unlockAudio(): void {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  } else {
    getCtx();
  }
}
