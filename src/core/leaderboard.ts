export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

const NAME_REGEX = /^[\p{L}0-9_]{3,12}$/u;

export function validateLeaderboardName(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = raw.trim();
  if (normalized.length < 3 || normalized.length > 12) {
    return {
      valid: false,
      normalized,
      error: "Tên phải dài từ 3 đến 12 ký tự.",
    };
  }
  if (!NAME_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Tên chỉ được dùng chữ cái, số hoặc dấu gạch dưới (_), không chứa khoảng trắng.",
    };
  }
  return { valid: true, normalized };
}

export function sortLeaderboardEntries(
  entries: ReadonlyArray<LeaderboardEntry>
): LeaderboardEntry[] {
  return [...entries]
    .filter(
      (e) =>
        e &&
        typeof e.name === "string" &&
        typeof e.score === "number" &&
        Number.isFinite(e.score) &&
        typeof e.nights_won === "number" &&
        typeof e.achieved_at === "string" &&
        typeof e.seed === "number"
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return ta - tb;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

export function addLeaderboardEntry(
  entries: ReadonlyArray<LeaderboardEntry>,
  next: LeaderboardEntry
): LeaderboardEntry[] {
  const check = validateLeaderboardName(next.name);
  if (!check.valid) {
    throw new Error(check.error ?? "Invalid leaderboard name");
  }
  const clean: LeaderboardEntry = {
    name: check.normalized,
    score: Math.max(0, Math.round(next.score)),
    nights_won: Math.max(0, Math.min(3, Math.trunc(next.nights_won))),
    achieved_at: next.achieved_at,
    seed: Math.trunc(next.seed),
  };
  return sortLeaderboardEntries([...entries, clean]);
}

export function formatIsoWithTimezone(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${tz}`
  );
}
