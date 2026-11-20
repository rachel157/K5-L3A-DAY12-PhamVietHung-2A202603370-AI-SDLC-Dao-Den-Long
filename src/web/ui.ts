import type { GameSnapshot, NightNumber } from "../core/types.js";
import type { GameSettings } from "./settings.js";
import { bindHudActionButton } from "./visualHelpers.js";

export type ScreenMode =
  | "menu"
  | "intro"
  | "playing"
  | "paused"
  | "settings"
  | "result";

export interface NightMetadata {
  night: NightNumber;
  islandName: string;
  title: string;
  ongDangSpeech: string;
}

export const NIGHT_METADATA: Record<NightNumber, NightMetadata> = {
  1: {
    night: 1,
    islandName: "Đảo Bến",
    title: "Đêm 1 · Đảo Bến",
    ongDangSpeech:
      "Ông Đăng: “Sương đen đã nuốt trọn năm ngọn đèn bến cảng. Mây hãy nhặt đom đóm, nhấn E nạp ánh sáng và thắp lại đảo trước bình minh nhé!”",
  },
  2: {
    night: 2,
    islandName: "Đảo Cau",
    title: "Đêm 2 · Đảo Cau",
    ongDangSpeech:
      "Ông Đăng: “Đêm nay có hai hòn đảo nối bằng cầu tre và bục gió. Hãy nhặt Bùa Gió ở giữa cầu để lướt liên tiếp — cẩn thận lũ Gió Lạc rình cướp đom đóm đấy!”",
  },
  3: {
    night: 3,
    islandName: "Đảo Chuông",
    title: "Đêm 3 · Đảo Chuông",
    ongDangSpeech:
      "Ông Đăng: “Đêm cuối trên đảo ba tầng gió mạnh! Theo hai con dốc đá hoặc bục nhảy lên Tháp Chuông, giữ vững bước chân khi gió nổi và thắp đủ 7 ngọn đèn!”",
  },
};

export interface GameUIHandlers {
  onStartCampaign: (night: NightNumber) => void;
  onStartNightFromIntro: () => void;
  onResume: () => void;
  onPauseRequest: () => void;
  onRestartNight: () => void;
  onNextNight: () => void;
  onReturnMenu: () => void;
  onToggleMute: () => void;
  onChangeSettings: (next: GameSettings) => void;
}

export interface HudDynamicView {
  nearestUnlitDeposited: number | null;
  nearestArrow: { visible: boolean; x: number; y: number; angleDeg: number };
  windWarning: boolean;
  windActive: boolean;
  windDirDeg: number;
  totalScore: number;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required UI element #${id}`);
  return node as T;
}

export class GameUI {
  private readonly hudRoot = el<HTMLElement>("hud-root");
  private readonly nightTitleEl = el<HTMLElement>("hud-night-title");
  private readonly flamesEl = el<HTMLElement>("hud-flames");
  private readonly charmPillEl = el<HTMLElement>("hud-charm-pill");
  private readonly windPillEl = el<HTMLElement>("hud-wind-pill");
  private readonly timeEl = el<HTMLElement>("hud-time");
  private readonly bannerEl = el<HTMLElement>("status-banner");
  private readonly lanternsEl = el<HTMLElement>("hud-lanterns");
  private readonly scoreEl = el<HTMLElement>("hud-score");
  private readonly totalScoreEl = el<HTMLElement>("hud-total-score");
  private readonly muteBtn = el<HTMLButtonElement>("btn-mute");
  private readonly pauseBtn = el<HTMLButtonElement>("btn-pause-hud");
  private readonly moteLabelEl = el<HTMLElement>("mote-slots-label");
  private readonly moteSlotsContainer = el<HTMLElement>("mote-slots");
  private readonly dashEl = el<HTMLElement>("hud-dash");
  private readonly pulseEl = el<HTMLElement>("hud-pulse");
  private readonly interactPromptEl = el<HTMLElement>("interact-prompt");
  private readonly arrowEl = el<HTMLElement>("offscreen-arrow");

  private readonly overlayEl = el<HTMLElement>("overlay");
  private readonly modalTitleEl = el<HTMLElement>("modal-title");
  private readonly modalSubtitleEl = el<HTMLElement>("modal-subtitle");
  private readonly modalBodyEl = el<HTMLElement>("modal-body");
  private readonly settingsPanelEl = el<HTMLElement>("settings-panel");
  private readonly volInput = el<HTMLInputElement>("setting-vol");
  private readonly volValEl = el<HTMLElement>("setting-vol-val");
  private readonly sensInput = el<HTMLInputElement>("setting-sens");
  private readonly sensValEl = el<HTMLElement>("setting-sens-val");
  private readonly settingsMuteBtn = el<HTMLButtonElement>("btn-settings-mute");
  private readonly modalActionsEl = el<HTMLElement>("modal-actions");

  private readonly moteSlotDivs: HTMLDivElement[] = [];
  private bannerTimeout: number | null = null;
  private returnFromSettings: "menu" | "pause" = "menu";
  private settingsOpen = false;
  private settings: GameSettings;
  private muted = false;

  constructor(
    initialSettings: GameSettings,
    private readonly handlers: GameUIHandlers
  ) {
    this.settings = { ...initialSettings };

    for (let i = 0; i < 10; i++) {
      const slot = document.createElement("div");
      slot.className = "mote-slot";
      this.moteSlotsContainer.appendChild(slot);
      this.moteSlotDivs.push(slot);
    }

    bindHudActionButton(this.muteBtn, () => handlers.onToggleMute());
    bindHudActionButton(this.pauseBtn, () => handlers.onPauseRequest());
    bindHudActionButton(this.settingsMuteBtn, () => handlers.onToggleMute());

    this.volInput.addEventListener("input", () => {
      this.settings.volume = Number(this.volInput.value) / 100;
      this.syncSettingsInputs();
      this.handlers.onChangeSettings({ ...this.settings });
    });

    this.sensInput.addEventListener("input", () => {
      this.settings.mouseSensitivity = Number(this.sensInput.value) / 100;
      this.syncSettingsInputs();
      this.handlers.onChangeSettings({ ...this.settings });
    });

    this.syncSettingsInputs();
  }

  private syncSettingsInputs(): void {
    this.volInput.value = String(Math.round(this.settings.volume * 100));
    this.volValEl.textContent = `${Math.round(this.settings.volume * 100)}%`;
    this.sensInput.value = String(Math.round(this.settings.mouseSensitivity * 100));
    this.sensValEl.textContent = `${this.settings.mouseSensitivity.toFixed(2)}x`;
  }

  setMuteLabel(muted: boolean): void {
    this.muted = muted;
    this.muteBtn.textContent = muted ? "Âm thanh: Tắt (M)" : "Âm thanh: Bật (M)";
    this.settingsMuteBtn.textContent = muted ? "Đang tắt tiếng — Bấm để bật" : "Đang bật tiếng — Bấm để tắt";
  }

  showBanner(text: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add("visible");
    if (this.bannerTimeout !== null) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.bannerEl.classList.remove("visible");
    }, 2600);
  }

  private clearActions(): void {
    this.settingsOpen = false;
    this.modalActionsEl.innerHTML = "";
    this.settingsPanelEl.style.display = "none";
  }

  isSettingsOpen(): boolean {
    return this.settingsOpen;
  }

  closeSettings(): void {
    if (!this.settingsOpen) return;
    if (this.returnFromSettings === "pause") {
      this.showPause();
    } else {
      this.showMainMenu();
    }
  }

  private addActionButton(label: string, onClick: () => void, secondary = false): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = secondary ? "modal-btn secondary" : "modal-btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    this.modalActionsEl.appendChild(btn);
    return btn;
  }

  showMainMenu(): void {
    this.hudRoot.classList.add("hidden");
    this.overlayEl.classList.add("open");
    this.clearActions();

    this.modalTitleEl.textContent = "Đảo Đèn Lồng";
    this.modalSubtitleEl.textContent = "Hành trình 3 đêm thắp sáng quần đảo giữa biển mây";
    this.modalBodyEl.textContent =
      "Điều khiển Mây thu thập đom đóm, lướt qua gió sương, xua tan Bóng Mực và thắp sáng các Đèn Lồng Lớn trước khi bình minh lên.";

    this.addActionButton("Chơi từ Đêm 1 · Đảo Bến", () => this.handlers.onStartCampaign(1));

    const picker = document.createElement("div");
    picker.className = "night-picker";
    for (const n of [1, 2, 3] as NightNumber[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "modal-btn secondary";
      b.textContent = `Đêm ${n}: ${NIGHT_METADATA[n].islandName}`;
      b.addEventListener("click", () => this.handlers.onStartCampaign(n));
      picker.appendChild(b);
    }
    this.modalActionsEl.appendChild(picker);

    this.addActionButton("Cài đặt", () => this.showSettings("menu"), true);
  }

  showNightIntro(night: NightNumber, totalScore: number): void {
    const meta = NIGHT_METADATA[night];
    this.hudRoot.classList.add("hidden");
    this.overlayEl.classList.add("open");
    this.clearActions();

    this.modalTitleEl.textContent = meta.title;
    this.modalSubtitleEl.textContent =
      totalScore > 0 ? `Tổng điểm chiến dịch: ${totalScore}` : "Chuẩn bị thắp sáng hòn đảo";
    this.modalBodyEl.textContent = meta.ongDangSpeech;

    this.addActionButton(`Bắt đầu ${meta.title}`, () => this.handlers.onStartNightFromIntro());
    this.addActionButton("Về menu chính", () => this.handlers.onReturnMenu(), true);
  }

  showPlaying(): void {
    this.overlayEl.classList.remove("open");
    this.hudRoot.classList.remove("hidden");
  }

  showPause(): void {
    this.hudRoot.classList.remove("hidden");
    this.overlayEl.classList.add("open");
    this.clearActions();

    this.modalTitleEl.textContent = "Tạm dừng";
    this.modalSubtitleEl.textContent = "Thời gian và sương đêm đang dừng lại";
    this.modalBodyEl.textContent = "Nhấn Esc hoặc P để quay lại trò chơi bất cứ lúc nào.";

    this.addActionButton("Tiếp tục", () => this.handlers.onResume());
    this.addActionButton("Chơi lại Đêm", () => this.handlers.onRestartNight(), true);
    this.addActionButton("Cài đặt", () => this.showSettings("pause"), true);
    this.addActionButton("Về menu chính", () => this.handlers.onReturnMenu(), true);
  }

  showSettings(from: "menu" | "pause"): void {
    this.returnFromSettings = from;
    this.overlayEl.classList.add("open");
    this.clearActions();
    this.settingsOpen = true;
    this.settingsPanelEl.style.display = "flex";
    this.syncSettingsInputs();
    this.setMuteLabel(this.muted);

    this.modalTitleEl.textContent = "Cài đặt";
    this.modalSubtitleEl.textContent = "Tùy chỉnh được lưu tự động trên trình duyệt";
    this.modalBodyEl.textContent = "";

    this.addActionButton("Quay lại", () => this.closeSettings());
  }

  showResult(params: {
    night: NightNumber;
    won: boolean;
    reason: string;
    nightScore: number;
    totalScore: number;
    lanternsLit: number;
    lanternsTotal: number;
  }): void {
    this.hudRoot.classList.remove("hidden");
    this.overlayEl.classList.add("open");
    this.clearActions();

    if (params.won && params.night === 3) {
      this.modalTitleEl.textContent = "Bình Minh Đã Lên!";
      this.modalSubtitleEl.textContent = "Hoàn thành cả 3 Đêm Quần Đảo Đèn Lồng";
      this.modalBodyEl.textContent = `Mây đã thắp sáng toàn bộ Đảo Bến, Đảo Cau và Đảo Chuông! Điểm Đêm 3: ${params.nightScore} · Tổng điểm chiến dịch: ${params.totalScore}.`;
      this.addActionButton("Chơi lại từ Đêm 1", () => this.handlers.onStartCampaign(1));
      this.addActionButton("Về menu chính", () => this.handlers.onReturnMenu(), true);
      return;
    }

    if (params.won) {
      this.modalTitleEl.textContent = `Thắp sáng ${NIGHT_METADATA[params.night].islandName}!`;
      this.modalSubtitleEl.textContent = `Đèn sáng: ${params.lanternsLit} / ${params.lanternsTotal}`;
      this.modalBodyEl.textContent = `Điểm Đêm ${params.night}: ${params.nightScore} · Tổng điểm hiện tại: ${params.totalScore}.`;
      this.addActionButton(`Sang Đêm ${params.night + 1}`, () => this.handlers.onNextNight());
      this.addActionButton("Chơi lại Đêm này", () => this.handlers.onRestartNight(), true);
      this.addActionButton("Về menu chính", () => this.handlers.onReturnMenu(), true);
      return;
    }

    this.modalTitleEl.textContent = "Ánh sáng vụt tắt...";
    this.modalSubtitleEl.textContent =
      params.reason === "no_flames"
        ? "Mây đã mất hết Ngọn Lửa."
        : "Trời đã hừng đông trước khi thắp đủ đèn.";
    this.modalBodyEl.textContent = `Đèn đã thắp: ${params.lanternsLit} / ${params.lanternsTotal} · Điểm Đêm ${params.night}: ${params.nightScore}.`;
    this.addActionButton("Chơi lại Đêm", () => this.handlers.onRestartNight());
    this.addActionButton("Về menu chính", () => this.handlers.onReturnMenu(), true);
  }

  updateHud(snap: GameSnapshot, dyn: HudDynamicView): void {
    this.nightTitleEl.textContent = NIGHT_METADATA[snap.night].title;

    // Zone 1: Flames
    let hearts = "";
    for (let i = 0; i < 3; i++) {
      hearts +=
        i < snap.player.flames
          ? `<span class="flame-on">♥</span> `
          : `<span class="flame-off">♡</span> `;
    }
    this.flamesEl.innerHTML = hearts.trim();

    if (snap.player.charm_s > 0) {
      this.charmPillEl.textContent = `Bùa Gió: ${Math.ceil(snap.player.charm_s)}s`;
      this.charmPillEl.classList.add("visible");
    } else {
      this.charmPillEl.classList.remove("visible");
    }

    if (dyn.windActive) {
      this.windPillEl.textContent = `Gió mạnh đang thổi (${Math.round(dyn.windDirDeg)}°)`;
      this.windPillEl.classList.add("visible");
    } else if (dyn.windWarning) {
      this.windPillEl.textContent = `Sắp có gió mạnh (${Math.round(dyn.windDirDeg)}°)`;
      this.windPillEl.classList.add("visible");
    } else {
      this.windPillEl.classList.remove("visible");
    }

    // Zone 2: Clock
    const secs = Math.max(0, Math.ceil(snap.time_left_s));
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    this.timeEl.textContent = `${mm}:${ss}`;
    this.timeEl.classList.toggle("urgent", secs <= 30 && snap.state === "playing");

    // Zone 3: Lanterns & Score
    const litCount = snap.lanterns.filter((l) => l.lit).length;
    this.lanternsEl.textContent = `${litCount} / ${snap.lanterns.length}`;
    this.scoreEl.textContent = String(snap.score);
    this.totalScoreEl.textContent = String(dyn.totalScore);

    // Zone 4: 10 Firefly Slots
    this.moteLabelEl.textContent = `Đom đóm: ${snap.player.carried} / 10`;
    for (let i = 0; i < this.moteSlotDivs.length; i++) {
      this.moteSlotDivs[i]?.classList.toggle("filled", i < snap.player.carried);
    }

    // Zone 5: Dash & Pulse Cooldowns
    if (snap.player.charm_s > 0) {
      this.dashEl.textContent = "Miễn hồi (Bùa Gió)";
      this.dashEl.classList.remove("dim");
    } else if (snap.player.dash_cd_s > 0) {
      this.dashEl.textContent = `${snap.player.dash_cd_s.toFixed(1)}s`;
      this.dashEl.classList.add("dim");
    } else {
      this.dashEl.textContent = "Sẵn sàng";
      this.dashEl.classList.remove("dim");
    }

    if (snap.player.pulse_cd_s > 0) {
      this.pulseEl.textContent = `${snap.player.pulse_cd_s.toFixed(1)}s`;
      this.pulseEl.classList.add("dim");
    } else if (snap.player.carried < 3) {
      this.pulseEl.textContent = "Cần 3 đom đóm";
      this.pulseEl.classList.add("dim");
    } else {
      this.pulseEl.textContent = "Sẵn sàng";
      this.pulseEl.classList.remove("dim");
    }

    // Zone 6: E Interact Prompt
    if (dyn.nearestUnlitDeposited !== null && snap.state === "playing") {
      this.interactPromptEl.textContent = `E — Nạp ánh sáng (${dyn.nearestUnlitDeposited}/10)`;
      this.interactPromptEl.classList.add("visible");
    } else {
      this.interactPromptEl.classList.remove("visible");
    }

    // Zone 7: Off-screen Nearest Unlit Lantern Arrow
    if (dyn.nearestArrow.visible && snap.state === "playing") {
      this.arrowEl.style.left = `${dyn.nearestArrow.x}px`;
      this.arrowEl.style.top = `${dyn.nearestArrow.y}px`;
      this.arrowEl.style.transform = `rotate(${dyn.nearestArrow.angleDeg}deg)`;
      this.arrowEl.classList.add("visible");
    } else {
      this.arrowEl.classList.remove("visible");
    }
  }
}
