// Pure rendering seam: no persistence, Node imports or changes to canonical content.
export function layoutCardLabels<T>(prefix: string, cards: T[]): (T & { label: string })[] {
  return cards.map((card, position) => ({ ...card, label: `${prefix} ${position + 1}` }));
}
