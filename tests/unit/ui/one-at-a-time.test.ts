import { expect, test } from 'vitest';
import { oneAtATime } from '../../../src/ui/one-at-a-time.ts';

/** A promise that the test resolves by hand. */
function gate() {
  let open!: () => void;
  const promise = new Promise<undefined>((res) => {
    open = () => {
      res(undefined);
    };
  });
  return { promise, open };
}

test('a call that starts while another runs waits for it to end', async () => {
  const order: string[] = [];
  const gates = [gate(), gate()];
  let i = 0;
  const keep = oneAtATime(async (name: string) => {
    const g = gates[i++];
    order.push(`start ${name}`);
    await g?.promise;
    order.push(`end ${name}`);
    return name;
  });
  const a = keep('a');
  const b = keep('b');
  await Promise.resolve();
  await Promise.resolve();
  expect(order).toEqual(['start a']);
  gates[0]?.open();
  expect(await a).toBe('a');
  await Promise.resolve();
  expect(order).toEqual(['start a', 'end a', 'start b']);
  gates[1]?.open();
  expect(await b).toBe('b');
  expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
});

test('a call that fails gives its error to its caller, and the next call still runs', async () => {
  const first = gate();
  let calls = 0;
  const keep = oneAtATime(async () => {
    calls++;
    if (calls === 1) {
      await first.promise;
      throw new Error('first failed');
    }
    return calls;
  });
  const a = keep();
  const b = keep();
  first.open();
  await expect(a).rejects.toThrow('first failed');
  expect(await b).toBe(2);
});

test('a call after the others ended runs at once', async () => {
  const keep = oneAtATime((n: number) => Promise.resolve(n * 2));
  expect(await keep(1)).toBe(2);
  expect(await keep(3)).toBe(6);
});
