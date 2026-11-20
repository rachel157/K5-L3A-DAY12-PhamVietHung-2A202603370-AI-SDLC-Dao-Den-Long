/**
 * Lightweight procedural Web Audio synthesizer for Đảo Đèn Lồng.
 * Runs purely in browser audio context with zero external audio assets.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      this.ctx = new AudioCtor();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0,
    endFreq?: number
  ): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === "suspended") return;

    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  }

  playPickup(carried: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = scale[(Math.max(1, carried) - 1) % scale.length] ?? 659.25;
    this.playTone(freq, 0.22, "sine", 0.09);
  }

  playDeposit(): void {
    this.playTone(440, 0.18, "triangle", 0.08);
    this.playTone(659.25, 0.22, "sine", 0.07, 0.06);
  }

  playLanternLit(): void {
    this.playTone(523.25, 0.45, "sine", 0.1, 0);
    this.playTone(659.25, 0.45, "sine", 0.09, 0.08);
    this.playTone(783.99, 0.55, "triangle", 0.1, 0.16);
    this.playTone(1046.5, 0.65, "sine", 0.08, 0.24);
  }

  playPulse(): void {
    this.playTone(320, 0.35, "sine", 0.12, 0, 880);
    this.playTone(640, 0.4, "triangle", 0.06, 0.05, 420);
  }

  playHit(): void {
    this.playTone(180, 0.28, "sawtooth", 0.1, 0, 75);
  }

  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.45, "sine", 0.11, idx * 0.11);
    });
  }

  playLoss(): void {
    const notes = [392.0, 349.23, 293.66, 220.0];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.4, "triangle", 0.09, idx * 0.12);
    });
  }
}
