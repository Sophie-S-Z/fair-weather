// The remix tree (ADR 0015 item 10): the kept links, each under the newest kept link in its lineage.
import type { KeptLink } from '../persist/profile.ts';

export interface RemixNode {
  link: KeptLink;
  children: RemixNode[];
}

/**
 * The kept links as trees, in kept order: `own` holds the links with no lineage and their remixes,
 * and `others` the links whose lineage holds no kept link (a valley someone else made).
 */
export function remixTree(links: readonly KeptLink[]): { own: RemixNode[]; others: RemixNode[] } {
  const nodes = new Map(links.map((link) => [link.id, { link, children: [] as RemixNode[] }]));
  const own: RemixNode[] = [];
  const others: RemixNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.link.from.findLast((id) => id !== node.link.id && nodes.has(id));
    if (parent !== undefined) nodes.get(parent)?.children.push(node);
    else (node.link.from.length === 0 ? own : others).push(node);
  }
  return { own, others };
}
