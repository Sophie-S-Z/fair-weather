/**
 * Runs `f` one call at a time: a call that starts while another runs waits for it to end, and
 * then runs. Each caller gets its own call's result or error; a failed call does not stop the next.
 */
export function oneAtATime<A extends unknown[], R>(
  f: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  let last: Promise<unknown> = Promise.resolve();
  return (...args) => {
    // `last` never rejects: it is the previous call, settled either way.
    const call = last.then(() => f(...args));
    last = call.catch(() => undefined);
    return call;
  };
}
