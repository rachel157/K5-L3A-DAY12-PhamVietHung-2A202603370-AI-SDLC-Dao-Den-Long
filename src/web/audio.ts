/**
 * Procedural Web Audio synthesizer for Đảo Đèn Lồng (night BGM + 10 SFX).
 * Purely procedural with zero external audio assets.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private volume = 0.7;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  constructor(initialVolume = 0.7) {
    this.setVolume(initialVolume);
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(vol: number): void {
    if (!Number.isFinite(vol)) return;
    this.volume = Math.max(0, Math.min(1, vol));
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopBgm();
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  startBgm(): void {
    if (typeof window === "undefined" || this.muted || this.bgmTimer !== null) return;
    const notes = [293.66, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 329.63];
    const playStep = () => {
      if (this.muted || this.volume <= 0) return;
      const root = notes[this.bgmStep % notes.length] ?? 293.66;
      this.playTone(root, 0.9, "sine", 0.025, 0);
      if (this.bgmStep % 2 === 0) {
        this.playTone(root * 0.5, 1.4, "triangle", 0.018, 0.05);
      }
      this.bgmStep++;
    };
    playStep();
    this.bgmTimer = window.setInterval(playStep, 1100);
  }

  stopBgm(): void {
    if (typeof window !== "undefined" && this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  destroy(): void {
    this.stopBgm();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
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
    baseVolume: number,
    delaySec = 0,
    endFreq?: number
  ): void {
    const scaledVol = baseVolume * this.volume;
    if (this.muted || scaledVol <= 0.0001) return;
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
    gain.gain.exponentialRampToValueAtTime(scaledVol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  }

  /** SFX 1: Nhặt đom đóm */
  playPickup(carried: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = scale[(Math.max(1, carried) - 1) % scale.length] ?? 659.25;
    this.playTone(freq, 0.22, "sine", 0.11);
  }

  /** SFX 2 (nạp) + Thắp đèn */
  playDeposit(): void {
    this.playTone(440, 0.18, "triangle", 0.09);
    this.playTone(659.25, 0.22, "sine", 0.08, 0.06);
  }

  playLanternLit(): void {
    this.playTone(523.25, 0.45, "sine", 0.12, 0);
    this.playTone(659.25, 0.45, "sine", 0.1, 0.08);
    this.playTone(783.99, 0.55, "triangle", 0.11, 0.16);
    this.playTone(1046.5, 0.65, "sine", 0.09, 0.24);
  }

  /** SFX 3: Tỏa sáng (Pulse) */
  playPulse(): void {
    this.playTone(320, 0.35, "sine", 0.14, 0, 880);
    this.playTone(640, 0.4, "triangle", 0.08, 0.05, 420);
  }

  /** SFX 4: Bị đánh */
  playHit(): void {
    this.playTone(190, 0.28, "sawtooth", 0.12, 0, 72);
  }

  /** SFX 5: Nhảy */
  playJump(): void {
    this.playTone(260, 0.16, "sine", 0.09, 0, 490);
  }

  /** SFX 6: Lướt (Dash) */
  playDash(): void {
    this.playTone(540, 0.18, "triangle", 0.1, 0, 190);
    this.playTone(760, 0.12, "sine", 0.06, 0.02, 320);
  }

  /** SFX 7: Thắng Đêm */
  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.45, "sine", 0.13, idx * 0.11);
    });
  }

  /** SFX 8: Thua Đêm */
  playLoss(): void {
    const notes = [392.0, 349.23, 293.66, 220.0];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.4, "triangle", 0.11, idx * 0.12);
    });
  }

  /** SFX 9: Bóng Mực xuất hiện */
  playShadeSpawn(): void {
    this.playTone(146.83, 0.45, "sawtooth", 0.07, 0, 110);
    this.playTone(220, 0.35, "sine", 0.05, 0.08, 165);
  }

  /** SFX 10: Đếm ngược 10 giây cuối */
  playCountdownTick(): void {
    this.playTone(880, 0.09, "sine", 0.09, 0, 740);
  }

  /** Bùa Gió / Gió Lạc cues */
  playCharmPicked(): void {
    this.playTone(587.33, 0.22, "sine", 0.1, 0);
    this.playTone(880.0, 0.28, "triangle", 0.1, 0.07);
    this.playTone(1174.66, 0.32, "sine", 0.08, 0.14);
  }

  playDrifterSteal(): void {
    this.playTone(740, 0.16, "triangle", 0.09, 0, 380);
  }
}
