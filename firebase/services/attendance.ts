/**
 * Data-access layer for the per-event 'attendance' subcollections
 * (events/{eventId}/attendance/{userId})
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { AttendanceStatus } from '../../lib/attendance';
import { db } from '../firebase';

export interface AttendanceEntry {
  eventId: string;
  userId: string;
  status: AttendanceStatus | undefined;
}

/** write (or overwrite) a single cadet's status for an event */
export async function saveAttendanceStatus(
    eventId: string,
    userId: string,
    status: AttendanceStatus,
    takenById: string
): Promise<void> {
    await setDoc(doc(db, 'events', eventId, 'attendance', userId), {
        userId,
        status,
        takenById
    });
}

/** One-shot read of every logged status for one event: { userId -> status } */
export async function fetchEventAttendance(eventId: string): Promise<Record<string, AttendanceStatus | undefined>> {
    const snap = await getDocs(collection(db, 'events', eventId, 'attendance'));
    const map: Record<string, AttendanceStatus | undefined> = {};
    snap.docs.forEach((d) => {
        map[d.id] = d.data().status as AttendanceStatus | undefined;
    });
    return map;
}

/** 
 * Bulk read of every attendance record accross all events, via a collection
 * group query. Only permitted for users with manage_attendance (enforced by
 * security rules), so use this from attendance-management screens only.
 */
export async function fetchAllAttendance(): Promise<AttendanceEntry[]> {
  const snap = await getDocs(collectionGroup(db, 'attendance'));
  return snap.docs.map((d) => ({
    eventId: d.ref.parent.parent!.id,
    userId: d.id,
    status: d.data().status as AttendanceStatus | undefined,
  }));
}

/** Real-time subscription to one event's attendance. Returns an unsubscribe fn. */
export function subscribeEventAttendance(
    eventId: string,
    onChange: (statuses: Record<string, AttendanceStatus | undefined>) => void
): () => void {
    return onSnapshot(collection(db, 'events', eventId, 'attendance'), (snap) => {
    const map: Record<string, AttendanceStatus | undefined> = {};
    snap.docs.forEach((d) => {
      map[d.id] = d.data().status as AttendanceStatus | undefined;
    });
    onChange(map);
  });
}

/**
 * Read one cadet's statuses accross a set of eents, by direct document path.
 * Returns { eventId -> status } for events where a status was logged.
 */
export async function fetchUserAttendanceForEvents(userId: string, eventIds: string[]): Promise<Record<string, AttendanceStatus>> {
  const docs = await Promise.all(
    eventIds.map((eventId) => getDoc(doc(db, 'events', eventId, 'attendance', userId)))
  );
  const map: Record<string, AttendanceStatus> = {};
  docs.forEach((d) => {
    if (d.exists()) {
      const eventId = d.ref.parent.parent!.id;
      map[eventId] = d.data().status as AttendanceStatus;
    }
  });
  return map;
}