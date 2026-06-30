import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert, Typography, Paper } from '@mui/material';
import { EventCalendar } from '@mui/x-scheduler';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../firebase/AuthContext';
import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  mandatory?: boolean;
  createdBy: string;
  lastEditedBy?: string;
}

const MANDATORY_TITLES = new Set(['pt', 'llab', 'dining out', 'dining in']);
const isMandatory = (title: string) => MANDATORY_TITLES.has(title.trim().toLowerCase());

const Events: React.FC = () => {
  const { currentUser } = useAuth();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      try {
        const eventsData: CalendarEvent[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const startRaw = data.startDate ?? data.date;
          const start =
            startRaw instanceof Timestamp
              ? startRaw.toDate()
              : startRaw
              ? new Date(startRaw)
              : new Date();
          const end =
            data.endDate instanceof Timestamp
              ? data.endDate.toDate()
              : new Date(start.getTime() + 3600000);
          return {
            id: docSnap.id,
            title: data.title,
            description: data.description,
            start,
            end,
            mandatory: data.mandatory,
            createdBy: data.createdBy,
            lastEditedBy: data.lastEditedBy,
          };
        });
        setEvents(eventsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events');
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [currentUser]);

  // Fired by MUI X Scheduler when events are created, dragged, resized, edited, or deleted
  const handleEventsChange = async (updatedEvents: any[]) => {
    if (!currentUser) return;

    const updatedMap = new Map(updatedEvents.map((e) => [e.id, e]));
    const currentMap = new Map(events.map((e) => [e.id, e]));

    // Deletions
    for (const [id] of currentMap) {
      if (!updatedMap.has(id)) {
        try {
          await deleteDoc(doc(db, 'events', id));
        } catch (err) {
          console.error('Error deleting event:', err);
          setError('Failed to delete event');
        }
      }
    }

    for (const [id, updated] of updatedMap) {
      const current = currentMap.get(id);
      const newStart = new Date(updated.start);
      const newEnd = new Date(updated.end);
      if (!current) {
        // New event created
        try {
          await setDoc(doc(db, 'events', id), {
            title: updated.title ?? 'New Event',
            description: updated.description ?? '',
            startDate: Timestamp.fromDate(newStart),
            endDate: Timestamp.fromDate(newEnd),
            mandatory: isMandatory(updated.title ?? ''),
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Error creating event:', err);
          setError('Failed to creating event');
        }
      } else {
        // Existing event updated
        const changed =
          updated.title !== current.title ||
          updated.description !== current.description ||
          newStart.getTime() !== current.start.getTime() ||
          newEnd.getTime() !== current.end.getTime();
        if (changed) {
          try {
            await updateDoc(doc(db, 'events', id), {
              title: updated.title,
              description: updated.description ?? '',
              startDate: Timestamp.fromDate(newStart),
              endDate: Timestamp.fromDate(newEnd),
              mandatory: isMandatory(updated.title),
              lastEditedBy: currentUser.uid,
            });
          } catch (err) {
            console.error('Error updating event:', err);
            setError('Failed to update event');
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ flex: 1, overflow: 'hidden' }}>
        <EventCalendar
          events={events.map((e) => ({ ...e, start: e.start.toISOString(), end: e.end.toISOString() }))}
          onEventsChange={handleEventsChange}
          areEventsDraggable
          areEventsResizable
          eventCreation={{ interaction: 'double-click' }}
          sx={{ height: '100%' }}
        />
      </Paper>
    </Box>
  );
};

export default Events;
