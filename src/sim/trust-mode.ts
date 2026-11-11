// Trust mode: a Case-style evolutionary tournament. Test-only; the game never imports it.
// Draw order per seed, from one PRNG: for each match (pairs in index order), for each round,
// the `random` strategy's draw for a then b (only when that strategy plays), then the noise
// draw for a then b; after each generation, one tie-break draw per member in index order.
import { createRng } from './rng.ts';

export type Strategy =
  'copycat' | 'copykitten' | 'alwaysGive' | 'alwaysKeep' | 'grudger' | 'detective' | 'simpleton' | 'random';

/** Strategy order; also breaks a tie on the final count. */
const ORDER: readonly Strategy[] = [
  'copycat',
  'copykitten',
  'alwaysGive',
  'alwaysKeep',
  'grudger',
  'detective',
  'simpleton',
  'random',
];

export interface TournamentConfig {
  population: Strategy[];
  rounds: number;
  noise: number;
  generations: number;
  /** Members removed and cloned per generation. */
  cut: number;
  seed: number;
}

const DETECTIVE_OPENING = [1, 0, 1, 1];

/** Moves are 1 = give, 0 = keep. `me` and `op` hold the moves actually played so far (noise included). */
function decide(s: Strategy, k: number, me: Uint8Array, op: Uint8Array, next: () => number): number {
  switch (s) {
    case 'copycat':
      return k === 0 ? 1 : (op[k - 1] as number);
    case 'copykitten':
      return k >= 2 && op[k - 1] === 0 && op[k - 2] === 0 ? 0 : 1;
    case 'alwaysGive':
      return 1;
    case 'alwaysKeep':
      return 0;
    case 'grudger': {
      for (let i = 0; i < k; i++) if (op[i] === 0) return 0;
      return 1;
    }
    case 'detective': {
      if (k < 4) return DETECTIVE_OPENING[k] as number;
      let kept = false;
      for (let i = 0; i < 4; i++) if (op[i] === 0) kept = true;
      return kept ? (op[k - 1] as number) : 0;
    }
    case 'simpleton': {
      if (k === 0) return 1;
      const mine = me[k - 1] as number;
      return op[k - 1] === 1 ? mine : 1 - mine;
    }
    case 'random':
      return next() < 0.5 ? 1 : 0;
  }
}

export function runTournament(cfg: TournamentConfig): {
  winner: Strategy;
  counts: Record<Strategy, number>;
} {
  const rng = createRng(cfg.seed);
  const next = rng.next;
  let pop = cfg.population.slice();
  const a = new Uint8Array(cfg.rounds);
  const b = new Uint8Array(cfg.rounds);

  for (let g = 0; g < cfg.generations; g++) {
    const n = pop.length;
    const score = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const si = pop[i] as Strategy;
        const sj = pop[j] as Strategy;
        for (let k = 0; k < cfg.rounds; k++) {
          let ma = decide(si, k, a, b, next);
          let mb = decide(sj, k, b, a, next);
          if (next() < cfg.noise) ma = 1 - ma;
          if (next() < cfg.noise) mb = 1 - mb;
          a[k] = ma;
          b[k] = mb;
          // Give costs 1; the receiver gets 3.
          score[i] = (score[i] as number) - ma + 3 * mb;
          score[j] = (score[j] as number) - mb + 3 * ma;
        }
      }
    }
    const tie = pop.map(() => next());
    const rank = pop
      .map((_, i) => i)
      .sort((x, y) => (score[x] as number) - (score[y] as number) || (tie[x] as number) - (tie[y] as number));
    const worst = new Set(rank.slice(0, cfg.cut));
    const best = rank.slice(n - cfg.cut).map((i) => pop[i] as Strategy);
    pop = pop.filter((_, i) => !worst.has(i)).concat(best);
    if (new Set(pop).size === 1) break;
  }

  const counts = Object.fromEntries(ORDER.map((s) => [s, 0])) as Record<Strategy, number>;
  for (const s of pop) counts[s] += 1;
  let winner: Strategy = ORDER[0] as Strategy;
  for (const s of ORDER) if (counts[s] > counts[winner]) winner = s;
  return { winner, counts };
}
