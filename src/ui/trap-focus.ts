// One Tab trap for every modal dialog: a Svelte action that keeps Tab and Shift+Tab inside a node.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Node.compareDocumentPosition's flag for "the other node comes later". */
const FOLLOWING = 4;

/**
 * Tab from the last focusable element goes to the first, and Shift+Tab from the first goes to the
 * last. Focus outside the node, or on the node or a heading before the first element, comes in at the
 * near end. Everything else is left to the browser. `active` false turns the trap off (a dialog that is
 * also a page).
 */
export function trapFocus(
  node: HTMLElement,
  active = true,
): { update(active: boolean): void; destroy(): void } {
  let on = active;
  const onKey = (e: KeyboardEvent): void => {
    if (!on || e.key !== 'Tab') return;
    const stops = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (s) => s.getClientRects().length > 0,
    );
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (first === undefined || last === undefined) {
      e.preventDefault();
      return;
    }
    const now = node.ownerDocument.activeElement;
    if (now === null || !node.contains(now)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey) {
      // Nothing before it: the first element, or the node or a heading ahead of the first.
      if (!stops.some((s) => s.compareDocumentPosition(now) & FOLLOWING)) {
        e.preventDefault();
        last.focus();
      }
    } else if (!stops.some((s) => now.compareDocumentPosition(s) & FOLLOWING)) {
      // Nothing after it: the last element, or one that follows the last.
      e.preventDefault();
      first.focus();
    }
  };
  node.addEventListener('keydown', onKey);
  return {
    update(next) {
      on = next;
    },
    destroy() {
      node.removeEventListener('keydown', onKey);
    },
  };
}
