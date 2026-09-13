export const MAX_PRESENCE_SELECTION_IDS = 50;

export function presenceSelectionIds(nodes: { id: string }[], edges: { id: string }[]): string[] {
  return [...new Set([...nodes, ...edges].map((item) => item.id))].slice(0, MAX_PRESENCE_SELECTION_IDS);
}
