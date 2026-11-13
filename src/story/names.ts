// How a creature id reads in text.

/** `'villager-3'` reads as `'Villager 3'`, `'pim'` as `'Pim'`. */
export function displayName(id: string): string {
  return (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, ' ');
}
