export type Sortable = { active: boolean; sort_order: number; category: string; name: string };

/**
 * Catalog order: active services first, inactive services always last.
 * Inside each group: display order, then category, then name.
 */
export function sortServices<T extends Sortable>(services: readonly T[]): T[] {
  return [...services].sort((a, b) =>
    Number(b.active) - Number(a.active) ||
    a.sort_order - b.sort_order ||
    a.category.localeCompare(b.category) ||
    a.name.localeCompare(b.name));
}
