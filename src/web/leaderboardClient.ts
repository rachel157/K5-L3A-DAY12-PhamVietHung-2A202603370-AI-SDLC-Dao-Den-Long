import {
  addLeaderboardEntry,
  sortLeaderboardEntries,
  type LeaderboardEntry,
} from "../core/leaderboard.js";

const LEADERBOARD_LOCAL_KEY = "dao-den-long:leaderboard:v1";

function readLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { entries?: LeaderboardEntry[] } | LeaderboardEntry[];
    const list = Array.isArray(parsed) ? parsed : parsed?.entries ?? [];
    return sortLeaderboardEntries(list);
  } catch {
    return [];
  }
}

function writeLocalLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    window.localStorage.setItem(LEADERBOARD_LOCAL_KEY, JSON.stringify({ entries }));
  } catch {
    // Ignore storage errors in private mode
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      const sorted = sortLeaderboardEntries(Array.isArray(data.entries) ? data.entries : []);
      writeLocalLeaderboard(sorted);
      return sorted;
    }
  } catch {
    // Static preview fallback uses localStorage
  }
  return readLocalLeaderboard();
}

export async function submitLeaderboardEntry(
  entry: LeaderboardEntry
): Promise<LeaderboardEntry[]> {
  const localUpdated = addLeaderboardEntry(readLocalLeaderboard(), entry);
  writeLocalLeaderboard(localUpdated);

  try {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (res.ok) {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      const sorted = sortLeaderboardEntries(Array.isArray(data.entries) ? data.entries : []);
      writeLocalLeaderboard(sorted);
      return sorted;
    }
  } catch {
    // Static preview fallback already saved to localStorage
  }
  return localUpdated;
}
