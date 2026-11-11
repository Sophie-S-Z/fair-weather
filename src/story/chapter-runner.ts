// The chapter runner (spec 10.1 to 10.4, 6.3): plays one chapter's beats, bets, twist window, and
// exit. Time is sim ticks from `snapshot` messages, never the wall clock, so a run over a direct
// port is deterministic. Honesty rule (spec 10.2): the runner arranges meetings and answers for
// the player only as listed in RUNNER_COMMANDS; it never edits a sim result.
//
// Nothing runs before the first snapshot: events that arrive earlier wait for it, and verb()
// returns false. The exit resolves on a snapshot, so written flags read a world that has applied
// every command the chapter sent before it.
import flagsJson from '../../content/flags.json';
import type { FromWorker, SimPort, WorldLite } from '../sim-host/protocol.ts';
import type { Command, SimEvent } from '../sim/types.ts';
import type { ActionLog } from './action-log.ts';
import { parseBeatTag } from './beat-tags.ts';
import type { BeatAction } from './beat-tags.ts';
import { measureBet } from './bets.ts';
import { FLAG_KEYS, parseFlags } from './flags.ts';
import type { FlagKey, Flags } from './flags.ts';
import type { InkRunner } from './ink.ts';
import { chapterTicksPerDay } from './scenario.ts';
import type { Chapter, ChapterBeat } from './schema.ts';
import { tuning } from './tuning.ts';
import { checkTwist } from './twists.ts';
import type { VerbInput } from './verbs.ts';

export type Prompt =
  | { kind: 'line'; text: string }
  | { kind: 'bet'; question: string; options: string[] }
  | { kind: 'reveal'; answer: string; result: string };

/**
 * The runner calls `port.speed(1)` when it starts. It leaves the speed where the chapter ends it
 * (a pause, or a bet's reveal speed after a skip): the end speed belongs to the next runner.
 */
export interface ChapterRunner {
  onPrompt(cb: (p: Prompt) => void): () => void;
  /** Camera shots named by beats; render owns the camera. */
  onCamera(cb: (shot: string) => void): () => void;
  /**
   * False when the verb is locked, no snapshot has arrived yet, the chapter is over (or the verb's
   * beat ended it with an error), or `respond` has no sky bid to answer.
   */
  verb(v: VerbInput): boolean;
  /** Ignored unless 'bet' is unlocked, a bet is open with no answer yet, and `option` is listed. */
  answerBet(option: string): void;
  skip(): Flags;
  done: Promise<Flags>;
  readonly log: ActionLog;
}

/** Every command the runner may send (spec 10.2). Sim speed goes through `port.speed`. */
export const RUNNER_COMMANDS: ReadonlySet<Command['t']> = new Set<Command['t']>([
  'arrangeMeeting',
  'setSeason',
  'promptSkyBid',
  'wake',
  'respond',
  'place',
]);

/** The one honesty check: throws on a command outside RUNNER_COMMANDS. */
export function assertRunnerCommand(cmd: Command): void {
  if (!RUNNER_COMMANDS.has(cmd.t)) throw new Error(`The chapter runner may not send '${cmd.t}'`);
}

const DEFAULT_FLAGS = parseFlags(flagsJson);

/** The command a player verb sends; `respond` answers `skyBidder`, the oldest unanswered sky bid. */
function verbCommand(v: VerbInput, skyBidder: string | undefined): Command | null {
  switch (v.verb) {
    case 'wake':
      return { t: 'wake', who: v.who };
    case 'respond':
      return skyBidder === undefined ? null : { t: 'respond', to: skyBidder, reply: v.reply };
    case 'place':
      return { t: 'place', kind: 'bench', x: v.x, y: v.y };
  }
}

/** The creature an event beat's `who` matches. */
function actor(e: SimEvent): string {
  switch (e.t) {
    case 'bid':
    case 'gift':
      return e.from;
    case 'opinion':
      return e.holder;
    default:
      return e.who;
  }
}

/**
 * Where each written flag comes from at the exit; undefined falls back to content/flags.json.
 * pimSkyOpinion is the sign of Pim's sky warmth (how Pim feels about the sky): above 0 gives 1,
 * below 0 gives -1, exactly 0 gives 0.
 */
const FLAG_SOURCES: {
  [K in FlagKey]: (lite: WorldLite | null, twistFired: boolean | undefined) => Flags[K] | undefined;
} = {
  pimSkyBond: (lite) => lite?.creatures.find((c) => c.id === 'pim')?.skyWarmth,
  pimSkyOpinion: (lite) => {
    const warmth = lite?.creatures.find((c) => c.id === 'pim')?.skyWarmth;
    if (warmth === undefined) return undefined;
    return warmth > 0 ? 1 : warmth < 0 ? -1 : 0;
  },
  pimScar: (_lite, twistFired) => twistFired,
  benchPlaced: (lite) => (lite ? lite.structures.length > 0 : undefined), // benches are the only structure
  friendThreads: (lite) => lite?.metrics.friendPairs,
};

function setFlag<K extends FlagKey>(flags: Flags, key: K, value: Flags[K]): void {
  flags[key] = value;
}

export function createChapterRunner(
  port: SimPort,
  ink: InkRunner,
  config: Chapter,
  flags: Flags,
): ChapterRunner {
  const sps = tuning.sim.stepsPerSecond;
  const ticksPerDay = chapterTicksPerDay(config);
  const log: ActionLog = [];
  const promptListeners = new Set<(p: Prompt) => void>();
  const cameraListeners = new Set<(shot: string) => void>();

  let origin: number | null = null; // chapter time 0, set by the first snapshot
  let tick = 0;
  let latest: WorldLite | null = null;
  let stepEvents: SimEvent[] = []; // the events of the step that the next snapshot follows
  const early: { tick: number; list: SimEvent[] }[] = []; // events before the first snapshot
  const firedBeats = new Set<string>();
  const skyBids: { who: string; tick: number }[] = [];
  let bet: { phase: 'idle' | 'open' | 'revealed' } | { phase: 'running'; answer: string; until: number } = {
    phase: 'idle',
  };
  // The open twist window; twistFired is set once the twist fired or the close call played.
  let twist: { before: WorldLite; deadline: number; retries: number } | null = null;
  let twistFired: boolean | undefined;
  let exitReady = false;
  let finished = false;
  let result: Flags | null = null;

  let resolveDone: (f: Flags) => void = () => undefined;
  let rejectDone: (e: unknown) => void = () => undefined;
  const done = new Promise<Flags>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  function send(cmd: Command): void {
    if (finished) return;
    assertRunnerCommand(cmd);
    port.send([cmd]);
  }
  function speed(multiplier: number): void {
    if (!finished) port.speed(multiplier);
  }
  function prompt(p: Prompt): void {
    if (finished) return;
    for (const cb of [...promptListeners]) cb(p);
  }

  /** Writes flags and sim values into Ink, plays the knot, and acts on its beat tags. */
  function play(knot: string): string[] {
    for (const key of FLAG_KEYS) ink.setVar(key, flags[key]);
    const pim = latest?.creatures.find((c) => c.id === 'pim');
    if (pim) ink.setVar('pim_sky_warmth', Math.round(pim.skyWarmth * 100) / 100);
    const { lines, tags } = ink.play(knot);
    const actions: BeatAction[] = [];
    for (const tag of tags) {
      if (!tag.startsWith('beat:')) continue;
      const action = parseBeatTag(tag);
      if (!action) throw new Error(`Unknown Ink tag "${tag}" in knot ${knot}`);
      actions.push(action);
    }
    for (const action of actions) act(action);
    return lines;
  }
  function say(knot: string): void {
    for (const text of play(knot)) prompt({ kind: 'line', text });
  }

  function act(a: ChapterBeat['actions'][number] | BeatAction): void {
    if (finished) return;
    if ('ink' in a) say(a.ink);
    else if ('arrange' in a) send({ t: 'arrangeMeeting', a: a.arrange[0], b: a.arrange[1] });
    else if ('camera' in a) for (const cb of [...cameraListeners]) cb(a.camera);
    else if ('pause' in a) speed(0);
    else if ('promptSkyBid' in a) send({ t: 'promptSkyBid', who: a.promptSkyBid });
    else openBet();
  }

  function openBet(): void {
    if (!config.bet) throw new Error(`Chapter ${config.id} opens a bet but has none`);
    if (bet.phase !== 'idle') return;
    bet = { phase: 'open' };
    const question = play(config.bet.knot).join(' ');
    speed(0); // before the prompt, so an answer given inside the prompt callback keeps its speed
    prompt({ kind: 'bet', question, options: [...config.bet.options] });
  }

  function runBeat(beat: ChapterBeat): void {
    firedBeats.add(beat.id);
    for (const a of beat.actions) act(a);
    if ('onBeat' in config.exit && config.exit.onBeat === beat.id) exitReady = true;
  }

  function withWrites(read: (key: FlagKey) => Flags[FlagKey] | undefined): Flags {
    const out: Flags = { ...flags };
    for (const key of config.writes) setFlag(out, key, read(key) ?? DEFAULT_FLAGS[key]);
    return out;
  }

  function finish(f: Flags): void {
    finished = true;
    result = f;
    off();
    resolveDone(f);
  }
  function fail(e: unknown): void {
    finished = true;
    off();
    rejectDone(e);
  }
  function maybeFinish(): void {
    if (finished || !exitReady || bet.phase === 'open' || bet.phase === 'running') return;
    finish(withWrites((key) => FLAG_SOURCES[key](latest, twistFired)));
  }

  /** Opens the twist window once, at `tick`; retries count from here. */
  function openTwist(): void {
    if (!config.twist || !latest || twist || twistFired !== undefined) return;
    twist = { before: latest, deadline: tick + config.twist.withinDays * ticksPerDay, retries: 0 };
  }

  function checkTwistWindow(t: number, lite: WorldLite): void {
    if (!twist || !config.twist) return;
    const { id, withinDays, retryArrange } = config.twist;
    if (checkTwist(id, twist.before, lite, stepEvents)) {
      twistFired = true;
    } else if (t >= twist.deadline) {
      if (twist.retries < tuning.story.honestyRetries) {
        twist.retries += 1;
        twist.deadline = t + withinDays * ticksPerDay;
        send({ t: 'arrangeMeeting', a: retryArrange[0], b: retryArrange[1] });
        return;
      }
      twistFired = false;
    } else {
      return;
    }
    log.push({ kind: 'twist', tick: t, id, fired: twistFired, retries: twist.retries });
    twist = null;
    if (twistFired) {
      for (const beat of config.beats) if (!firedBeats.has(beat.id) && 'twist' in beat.trigger) runBeat(beat);
    } else {
      say(`${config.id}_close_call`);
    }
    if ('onTwist' in config.exit) exitReady = true;
  }

  function onSnapshot(t: number, lite: WorldLite): void {
    latest = lite;
    tick = t;
    if (origin === null) {
      origin = t - 1; // the tick the first step ran: chapter time 0
      if (!config.twist?.opensOn) openTwist();
    }
    const replyTicks = tuning.story.skyBidReplySeconds * sps;
    for (let bid = skyBids[0]; bid && t >= bid.tick + replyTicks; bid = skyBids[0]) {
      skyBids.shift();
      send({ t: 'respond', to: bid.who, reply: 'away' });
    }
    if (bet.phase === 'running' && config.bet && t >= bet.until) {
      const answer = bet.answer;
      const measured = String(measureBet(config.bet.metric, lite));
      bet = { phase: 'revealed' };
      speed(1);
      log.push({ kind: 'bet', tick: t, id: config.bet.id, answer, result: measured });
      prompt({ kind: 'reveal', answer, result: measured });
    }
    checkTwistWindow(t, lite);
    stepEvents = [];
    for (const beat of config.beats) {
      if (firedBeats.has(beat.id) || !('at' in beat.trigger)) continue;
      if (t - origin >= Math.round(beat.trigger.at * sps)) runBeat(beat);
    }
    // Events from before the first snapshot run after chapter time 0's beats.
    for (const e of early.splice(0)) onEvents(e.tick, e.list);
    stepEvents = [];
    if ('afterDays' in config.exit && t - origin >= config.exit.afterDays * ticksPerDay) exitReady = true;
    maybeFinish();
  }

  function onEvents(t: number, list: SimEvent[]): void {
    if (origin === null) {
      early.push({ tick: t, list });
      return;
    }
    stepEvents = list;
    for (const e of list) {
      if (e.t === 'skyBid') skyBids.push({ who: e.who, tick: t });
      for (const beat of config.beats) {
        const trigger = beat.trigger;
        if (firedBeats.has(beat.id) || !('event' in trigger) || trigger.event !== e.t) continue;
        if (trigger.who === undefined || trigger.who === actor(e)) runBeat(beat);
      }
    }
  }

  function handle(m: FromWorker): void {
    if (finished) return;
    try {
      if (m.t === 'accepted') log.push({ kind: 'accepted', tick: m.tick, list: m.list });
      else if (m.t === 'events') onEvents(m.tick, m.list);
      else if (m.t === 'snapshot') onSnapshot(m.tick, m.lite);
    } catch (e) {
      fail(e);
    }
  }

  const off = port.onMessage(handle);
  port.speed(1); // the chapter starts at normal speed

  return {
    onPrompt(cb) {
      promptListeners.add(cb);
      return () => promptListeners.delete(cb);
    },
    onCamera(cb) {
      cameraListeners.add(cb);
      return () => cameraListeners.delete(cb);
    },
    verb(v) {
      if (finished || origin === null || !config.verbs.includes(v.verb)) return false;
      const cmd = verbCommand(v, skyBids[0]?.who);
      if (!cmd) return false;
      try {
        if (cmd.t === 'respond') skyBids.shift();
        send(cmd);
        log.push({ kind: 'verb', tick, input: v });
        for (const beat of config.beats) {
          if (!firedBeats.has(beat.id) && 'verb' in beat.trigger && beat.trigger.verb === v.verb)
            runBeat(beat);
        }
        if (config.twist?.opensOn?.verb === v.verb) openTwist();
      } catch (e) {
        fail(e);
      }
      return !finished;
    },
    answerBet(option) {
      if (finished || !config.verbs.includes('bet') || bet.phase !== 'open') return;
      if (!config.bet?.options.includes(option)) return;
      bet = { phase: 'running', answer: option, until: tick + config.bet.afterDays * ticksPerDay };
      speed(tuning.bet.revealSpeed);
    },
    skip() {
      const skipped = withWrites((key) => DEFAULT_FLAGS[key]);
      if (!finished) finish(skipped);
      return result ?? skipped;
    },
    done,
    log,
  };
}
