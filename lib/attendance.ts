// Shared attendance domain: types, event types, status cycles, colors, and the
// single source of truth for the absence calculation used across the app.

export type AttendanceStatus =
    | 'Present'
    | 'Absent'
    | 'Late'
    | 'Excused'
    | 'Voluntarily Present';

export const EVENT_TYPES = ['PT', 'LLAB', 'RMP'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Status button / heatmap colors, keyed by status **/
export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: '#2e7d32',
  Absent: '#c62828',
  Late: '#f9a825',
  Excused: '#81c784',
  'Voluntarily Present': '#1565c0',
};

export const BASE_CYCLE: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];
export const RMP_CYCLE: AttendanceStatus[] = [...BASE_CYCLE, 'Voluntarily Present'];

/**
    Cycle order used when clicking through statuses. RMP events add the
    "Voluntarily Present" option.
**/
export function cycleFor(eventType: EventType): AttendanceStatus[] {
  return eventType === 'RMP' ? RMP_CYCLE : BASE_CYCLE;
}

/**
    Resolve an event's type from its (case-insensitive) title. Returns null if the
    title is not one of the known mandatory event types.
**/
export function eventTypeFromTitle(title: string): EventType | null {
  const t = title.trim().toUpperCase();
  return (EVENT_TYPES as readonly string[]).includes(t) ? (t as EventType) : null;
}

/** Available statuses for a given event title (RMP gets the extra option). **/
export function statusesForTitle(title: string): AttendanceStatus[] {
  return eventTypeFromTitle(title) === 'RMP' ? RMP_CYCLE : BASE_CYCLE;
}

export function nextStatus(
  current: AttendanceStatus | undefined,
  cycle: AttendanceStatus[]
): AttendanceStatus {
  if (!current) return cycle[0];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  voluntarilyPresent: number;
  absencesAllowed: number;
  absencesUsed: number;
  absencesRemaining: number;
}

/** 
    Absences allowed = the largest count (rounded down to the nearest 0.5) that
    keeps attendance at or above 80%: floor(totalEvents * 0.20, to nearest 0.5).
    Absences used = absents + 0.5 * lates. Both derived from logged statuses only;
    `total` should include unlogged events (pass them as `undefined`). 
**/
export function summarize(statuses: (AttendanceStatus | undefined)[]): AttendanceSummary {
  const total = statuses.length;
  const count = (s: AttendanceStatus) => statuses.filter((x) => x === s).length;

  const present = count('Present');
  const absent = count('Absent');
  const late = count('Late');
  const excused = count('Excused');
  const voluntarilyPresent = count('Voluntarily Present');

  const absencesAllowed = Math.floor(total * 0.2 * 2) / 2;
  const absencesUsed = absent + late * 0.5;

  return {
    total,
    present,
    absent,
    late,
    excused,
    voluntarilyPresent,
    absencesAllowed,
    absencesUsed,
    absencesRemaining: absencesAllowed - absencesUsed,
  };
}

/** 
    Format the remaining-absences value for display. Returns an em dash when there
    are no events to measure against. 
**/
export function formatRemaining(summary: AttendanceSummary): string {
  if (summary.total === 0) return '—';
  const r = summary.absencesRemaining;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

/** Convenience: remaining-absences string straight from a list of statuses. **/
export function absencesRemainingFromStatuses(
  statuses: (AttendanceStatus | undefined)[]
): string {
  return formatRemaining(summarize(statuses));
}