export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type KeyAction =
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "jump"
  | "dash"
  | "interact"
  | "pulse"
  | "pause";

export type KeyBindings = Record<KeyAction, string>;

export const DEFAULT_KEYBINDS: KeyBindings = {
  moveForward: "KeyW",
  moveBackward: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  jump: "Space",
  dash: "ShiftLeft",
  interact: "KeyE",
  pulse: "KeyR",
  pause: "Escape",
};

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  moveForward: "Đi thẳng",
  moveBackward: "Đi lùi",
  moveLeft: "Sang trái",
  moveRight: "Sang phải",
  jump: "Nhảy",
  dash: "Lướt",
  interact: "Nạp / Châm dầu",
  pulse: "Tỏa sáng",
  pause: "Tạm dừng",
};

export interface GameSettings {
  volume: number;
  mouseSensitivity: number;
  colorblindMode: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  keybinds: KeyBindings;
}

export const SETTINGS_STORAGE_KEY = "dao-den-long:settings:v1";

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.7,
  mouseSensitivity: 1.0,
  colorblindMode: false,
  reduceMotion: false,
  largeText: false,
  keybinds: { ...DEFAULT_KEYBINDS },
};

function clamp(val: number, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
}

export function findDuplicateKeybind(
  keybinds: KeyBindings,
  targetAction: KeyAction,
  code: string
): KeyAction | null {
  for (const action of Object.keys(DEFAULT_KEYBINDS) as KeyAction[]) {
    if (action !== targetAction && keybinds[action] === code) {
      return action;
    }
  }
  return null;
}

export function formatKeyCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "Escape") return "Esc";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

function normalizeKeybinds(raw?: Partial<KeyBindings> | null): KeyBindings {
  const result: KeyBindings = { ...DEFAULT_KEYBINDS };
  if (!raw || typeof raw !== "object") return result;
  for (const action of Object.keys(DEFAULT_KEYBINDS) as KeyAction[]) {
    const val = raw[action];
    if (typeof val === "string" && val.trim().length > 0) {
      result[action] = val;
    }
  }
  return result;
}

export function normalizeSettings(input?: Partial<GameSettings> | null): GameSettings {
  return {
    volume: clamp(input?.volume ?? DEFAULT_SETTINGS.volume, 0, 1, DEFAULT_SETTINGS.volume),
    mouseSensitivity: clamp(
      input?.mouseSensitivity ?? DEFAULT_SETTINGS.mouseSensitivity,
      0.2,
      2.5,
      DEFAULT_SETTINGS.mouseSensitivity
    ),
    colorblindMode:
      typeof input?.colorblindMode === "boolean"
        ? input.colorblindMode
        : DEFAULT_SETTINGS.colorblindMode,
    reduceMotion:
      typeof input?.reduceMotion === "boolean"
        ? input.reduceMotion
        : DEFAULT_SETTINGS.reduceMotion,
    largeText:
      typeof input?.largeText === "boolean"
        ? input.largeText
        : DEFAULT_SETTINGS.largeText,
    keybinds: normalizeKeybinds(input?.keybinds),
  };
}

function resolveStorage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  const g = globalThis as { localStorage?: StorageLike };
  return g.localStorage ?? null;
}

export function loadSettings(storage?: StorageLike | null): GameSettings {
  const target = resolveStorage(storage);
  if (!target) return normalizeSettings();
  try {
    const raw = target.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return normalizeSettings();
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    if (!parsed || typeof parsed !== "object") return normalizeSettings();
    return normalizeSettings(parsed);
  } catch {
    return normalizeSettings();
  }
}

export function saveSettings(
  settings: Partial<GameSettings>,
  storage?: StorageLike | null
): GameSettings {
  const normalized = normalizeSettings(settings);
  const target = resolveStorage(storage);
  if (target) {
    try {
      target.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore quota / private-mode storage errors safely
    }
  }
  return normalized;
}
