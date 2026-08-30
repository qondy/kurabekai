import { Entry, Tasting } from './tastings';

export const MAX_SCORE = 5;

// ============================================================
// 点数評価
// ============================================================
export interface RankItem {
  entry: Entry;
  index: number;
  total: number;
  perAxis: Record<string, number>;
  filled: number;
}

export function rankByScore(t: Tasting): RankItem[] {
  const items: RankItem[] = t.entries.map((entry, index) => {
    const s = t.scores[entry.id] || {};
    let total = 0;
    let filled = 0;
    const perAxis: Record<string, number> = {};
    for (const ax of t.axes) {
      const v = Number(s[ax]) || 0;
      perAxis[ax] = v;
      total += v;
      if (v > 0) filled += 1;
    }
    return { entry, index, total, perAxis, filled };
  });
  items.sort((a, b) => b.total - a.total || a.entry.name.localeCompare(b.entry.name, 'ja'));
  return items;
}

export function scoreComplete(t: Tasting): boolean {
  if (t.entries.length < 2 || t.axes.length === 0) return false;
  return t.entries.every((e) => t.axes.every((ax) => (Number(t.scores[e.id]?.[ax]) || 0) > 0));
}

// 全採点済みで単独トップなら勝者。同点トップなら null。
export function scoreChampion(t: Tasting): Entry | null {
  if (!scoreComplete(t)) return null;
  const ranked = rankByScore(t);
  if (ranked.length === 1) return ranked[0].entry;
  if (ranked[0].total > ranked[1].total) return ranked[0].entry;
  return null;
}

// ============================================================
// トーナメント
// ============================================================
export interface BMatch {
  key: string;
  round: number;
  index: number;
  a: Entry | null;
  b: Entry | null;
  winner: Entry | null;
  decidable: boolean;
}

export interface Bracket {
  rounds: BMatch[][];
  champion: Entry | null;
}

export function buildBracket(entries: Entry[], results: Record<string, string>): Bracket {
  if (entries.length < 2) return { rounds: [], champion: null };

  let size = 1;
  while (size < entries.length) size *= 2;

  const byId = new Map(entries.map((e) => [e.id, e]));

  let current: (Entry | null)[] = [];
  for (let i = 0; i < size; i += 1) current.push(entries[i] ?? null);

  const rounds: BMatch[][] = [];
  let round = 0;

  while (current.length >= 2) {
    const matches: BMatch[] = [];
    const next: (Entry | null)[] = [];

    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      const key = `r${round}m${i / 2}`;
      let winner: Entry | null = null;

      if (a && !b) winner = a;
      else if (!a && b) winner = b;
      else if (a && b) {
        const wid = results[key];
        winner = wid ? byId.get(wid) ?? null : null;
      }

      matches.push({ key, round, index: i / 2, a, b, winner, decidable: !!(a && b) });
      next.push(winner);
    }

    rounds.push(matches);
    current = next;
    round += 1;
  }

  const last = rounds[rounds.length - 1];
  const champion = last && last.length === 1 ? last[0].winner : null;
  return { rounds, champion };
}

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return '決勝';
  if (fromEnd === 1) return '準決勝';
  if (fromEnd === 2) return '準々決勝';
  return `${round + 1}回戦`;
}

export function tournamentProgress(bracket: Bracket): { done: number; total: number } {
  let done = 0;
  let total = 0;
  bracket.rounds.forEach((r) => {
    r.forEach((m) => {
      if (m.decidable) {
        total += 1;
        if (m.winner) done += 1;
      }
    });
  });
  return { done, total };
}
