// The worker entry: connects the core to `self` (ADR 0009 item 6).
import type { ToWorker } from './protocol.ts';
import { createWorkerCore } from './worker-core.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const handle = createWorkerCore(
  (m) => {
    scope.postMessage(m);
  },
  {
    now: () => performance.now(),
    every(ms, fn) {
      const id = setInterval(fn, ms);
      return () => {
        clearInterval(id);
      };
    },
  },
  { dev: import.meta.env.DEV },
);
scope.onmessage = (e: MessageEvent<ToWorker>) => {
  handle(e.data);
};
