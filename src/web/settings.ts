export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GameSettings {
  volume: number;
  mouseSensitivity: number;
}

export const SETTINGS_STORAGE_KEY = "dao-den-long:settings:v1";

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.7,
  mouseSensitivity: 1.0,
};

function clamp(val: number, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val * 100) / 100));
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
  };
}

function resolveStorage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  const g = globalThis as { localStorage?: StorageLike };
  return g.localStorage ?? null;
}

export function loadSettings(storage?: StorageLike | null): GameSettings {
  const target = resolveStorage(storage);
  if (!target) return { ...DEFAULT_SETTINGS };
  try {
    const raw = target.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
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
