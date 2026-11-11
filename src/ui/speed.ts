// Sim speed from its two askers (ADR 0011). The runner asks for 0 (a pause), 1, or a bet's reveal
// speed; the player picks pause, 1x, or 2x. The sim gets the runner's speed times the player's
// choice, so a runner speed change never drops the player's 2x, and a pause from either stays 0.
// No time passes unseen: while the tab is hidden the sim gets 0.
export interface SpeedControl {
  /** The runner's speed. */
  runner(multiplier: number): void;
  /** The player's choice: 0 pauses; 1 or 2 is kept as the multiplier and resumes a pause. */
  player(multiplier: number): void;
  setHidden(hidden: boolean): void;
  /** The speed asked for now (runner times player), whether or not the tab is hidden. */
  current(): number;
}

export function createSpeedControl(send: (multiplier: number) => void, hidden: boolean): SpeedControl {
  let base = 0;
  let choice = 1;
  const push = (): void => {
    send(hidden ? 0 : base * choice);
  };
  return {
    runner(m) {
      base = m;
      push();
    },
    player(m) {
      if (m <= 0) base = 0;
      else {
        choice = m;
        if (base === 0) base = 1;
      }
      push();
    },
    setHidden(h) {
      if (h === hidden) return;
      hidden = h;
      push();
    },
    current: () => base * choice,
  };
}
