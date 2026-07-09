/**
 * Data-access layer for the 'events collection. Keeps Firestore query
 * construction out of the UI components.
 */

import { collection, getDocs, query, QueryConstraint, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface EventRecord {
  id: string;
  title: string;
  startDate: Date;
  mandatory: boolean;
  location?: string;
}

function toEventRecord(id: string, data: any): EventRecord {
  return {
    id,
    title: data.title,
    startDate: (data.startDate as Timestamp)?.toDate?.() ?? new Date(0),
    mandatory: data.mandatory ?? false,
    location: data.location,
  };
}

export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * Fetch mandatory events, optionally bounded by a start/end date range,
 * sorted chronologically.
 */
export async function fetchMandatoryEvents(range?: DateRange): Promise<EventRecord[]> {
  const constraints: QueryConstraint[] = [where('mandatory', '==', true)];
  if (range?.start) {
    constraints.push(where('startDate', '>=', Timestamp.fromDate(range.start)));
  }
  if (range?.end) {
    constraints.push(where('startDate', '<=', Timestamp.fromDate(range.end)));
  }

  const snap = await getDocs(query(collection(db, 'events'), ...constraints));
  return snap.docs
    .map((d) => toEventRecord(d.id, d.data()))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/** Fetch today's mandatory events (local-day bounds) */
export async function fetchTodaysMandatoryEvents(now: Date = new Date()): Promise<EventRecord[]> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return fetchMandatoryEvents({ start, end });
}
