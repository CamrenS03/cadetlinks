// Shared cadet/organization constants and label helpers.

export const FLIGHTS = ['Alpha', 'Bravo', 'POC'] as const;
export type Flight = (typeof FLIGHTS)[number];

// Class-year codes in seniority order (freshman → senior). Used for sorting
// rosters and for mapping to the AS-year label.
export const CLASS_YEAR_ORDER = ['100', '150', '200', '250', '300', '400'] as const;

// Sort comparator for class-year codes in seniority order.
export function compareClassYear(a?: string, b?: string): number {
  return CLASS_YEAR_ORDER.indexOf(a as any) - CLASS_YEAR_ORDER.indexOf(b as any);
}
