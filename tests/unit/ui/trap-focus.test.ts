import { describe, expect, it } from 'vitest';
import { trapFocus } from '../../../src/ui/trap-focus.ts';

/** A node with focusable children in document order, and just enough DOM for the action. */
function setup(count: number, hidden: number[] = []) {
  const doc = { activeElement: null as unknown };
  const order: unknown[] = [];
  const mk = (name: string) => {
    const el = {
      name,
      focus: () => {
        doc.activeElement = el;
      },
      getClientRects: () => (hidden.includes(order.indexOf(el)) ? [] : [{}]),
      compareDocumentPosition: (other: unknown) => {
        const a = order.indexOf(el);
        const b = order.indexOf(other);
        return b > a ? 4 : 2;
      },
    };
    order.push(el);
    return el;
  };
  const node = mk('node');
  const kids = Array.from({ length: count }, (_, i) => mk(`k${String(i)}`));
  const outside = mk('outside');
  let selector = '';
  const handlers = new Map<string, (e: unknown) => void>();
  Object.assign(node, {
    ownerDocument: doc,
    contains: (x: unknown) => x === node || kids.includes(x as (typeof kids)[number]),
    querySelectorAll: (s: string) => {
      selector = s;
      return kids;
    },
    addEventListener: (t: string, f: (e: unknown) => void) => handlers.set(t, f),
    removeEventListener: (t: string) => handlers.delete(t),
  });
  const action = trapFocus(node as unknown as HTMLElement);
  const press = (key: string, shiftKey = false) => {
    let prevented = false;
    handlers.get('keydown')?.({ key, shiftKey, preventDefault: () => (prevented = true) });
    return prevented;
  };
  return { doc, kids, node, outside, action, press, handlers, selector: () => selector };
}

describe('trapFocus', () => {
  it('asks for the focusable elements', () => {
    const t = setup(2);
    t.kids[0]?.focus();
    t.press('Tab');
    expect(t.selector()).toBe(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
  });
  it('wraps Tab from the last element to the first', () => {
    const t = setup(3);
    t.kids[2]?.focus();
    expect(t.press('Tab')).toBe(true);
    expect(t.doc.activeElement).toBe(t.kids[0]);
  });
  it('wraps Shift+Tab from the first element to the last', () => {
    const t = setup(3);
    t.kids[0]?.focus();
    expect(t.press('Tab', true)).toBe(true);
    expect(t.doc.activeElement).toBe(t.kids[2]);
  });
  it('leaves Tab in the middle to the browser', () => {
    const t = setup(3);
    t.kids[1]?.focus();
    expect(t.press('Tab')).toBe(false);
    expect(t.press('Tab', true)).toBe(false);
    expect(t.doc.activeElement).toBe(t.kids[1]);
  });
  it('pulls focus in from outside, and from the dialog itself on Shift+Tab', () => {
    const t = setup(3);
    t.outside.focus();
    t.press('Tab');
    expect(t.doc.activeElement).toBe(t.kids[0]);
    t.outside.focus();
    t.press('Tab', true);
    expect(t.doc.activeElement).toBe(t.kids[2]);
    t.node.focus();
    t.press('Tab', true);
    expect(t.doc.activeElement).toBe(t.kids[2]);
    t.node.focus();
    expect(t.press('Tab')).toBe(false);
  });
  it('skips elements that are not shown', () => {
    const t = setup(3, [3]);
    t.kids[1]?.focus();
    t.press('Tab');
    expect(t.doc.activeElement).toBe(t.kids[0]);
  });
  it('keeps focus where it is when nothing can take it', () => {
    const t = setup(0);
    t.node.focus();
    expect(t.press('Tab')).toBe(true);
    expect(t.doc.activeElement).toBe(t.node);
  });
  it('ignores other keys, and stops on destroy or when turned off', () => {
    const t = setup(2);
    t.kids[1]?.focus();
    expect(t.press('Enter')).toBe(false);
    t.action.update(false);
    expect(t.press('Tab')).toBe(false);
    t.action.update(true);
    expect(t.press('Tab')).toBe(true);
    t.action.destroy();
    expect(t.handlers.has('keydown')).toBe(false);
  });
});
