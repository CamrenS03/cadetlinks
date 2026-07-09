import CheckIcon from '@mui/icons-material/Check';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { EventCalendar } from '@mui/x-scheduler';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../../../firebase/firebase';
import { useUser } from '../../../hooks/useUser';

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

interface RsvpStatus {
  [eventId: string]: boolean | undefined;
}

interface RsvpGoers {
  [eventId: string]: string[];
}

const MANDATORY_TITLES = new Set(['pt', 'llab', 'dining out', 'dining in']);
const isMandatory = (title: string) => MANDATORY_TITLES.has(title.trim().toLowerCase());

function formatEventTime(start: Date, end: Date): string {
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endStr = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startStr}–${endStr}`;
}

const Events: React.FC = () => {
  const currentUser = useUser().userData;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>({});
  const [rsvpGoers, setRsvpGoers] = useState<RsvpGoers>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});

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

  // All future non-mandatory events, sorted chronologically
  const now = new Date();
  const rsvpableEvents = events
    .filter((e) => e.start > now && !e.mandatory)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Subscribe to RSVPs for visible events when panel is open
  useEffect(() => {
    if (!currentUser || !panelOpen || rsvpableEvents.length === 0) return;

    const unsubs: (() => void)[] = [];

    for (const event of rsvpableEvents) {
      const rsvpsRef = collection(db, 'events', event.id, 'rsvps');

      const unsubMy = onSnapshot(doc(rsvpsRef, currentUser.uid), (snap) => {
        setRsvpStatus((prev) => ({
          ...prev,
          [event.id]: snap.exists() ? (snap.data()?.going as boolean) : undefined,
        }));
      });
      unsubs.push(unsubMy);

      const unsubAll = onSnapshot(rsvpsRef, (snap) => {
        const names = snap.docs
          .filter((d) => d.data()?.going === true)
          .map((d) => d.data()?.displayName as string)
          .filter(Boolean);
        setRsvpGoers((prev) => ({ ...prev, [event.id]: names }));
      });
      unsubs.push(unsubAll);
    }

    return () => unsubs.forEach((u) => u());
  }, [currentUser, panelOpen, rsvpableEvents.map((e) => e.id).join(',')]);

  const handleRsvp = useCallback(
    async (eventId: string, going: boolean) => {
      if (!currentUser) return;
      const current = rsvpStatus[eventId];
      const next = current === going ? null : going;

      setRsvpLoading((prev) => ({ ...prev, [eventId]: true }));
      try {
        const rsvpRef = doc(db, 'events', eventId, 'rsvps', currentUser.uid);
        if (next == null) {
          await deleteDoc(rsvpRef);
          //console.log(`[handleRsvp] ${currentUser.displayName} has canceled their RSVP to eventId: `, eventId);
        } else {
          await setDoc(rsvpRef, {
            userId: currentUser.uid,
            displayName: currentUser.displayName ?? currentUser.email ?? '',
            going: next,
            rsvpAt: serverTimestamp(),
          });
          console.log(`[handleRsvp] ${currentUser.displayName} has RSVP'd to eventId: `, eventId);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to save RSVP');
      } finally {
        setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
      }
    },
    [currentUser, rsvpStatus]
  );

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
          setError('Failed to create event');
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: '400px',
        }}
      >
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

      <Paper
        sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <EventCalendar
          events={events.map((e) => ({
            ...e,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          }))}
          onEventsChange={handleEventsChange}
          areEventsDraggable
          areEventsResizable
          eventCreation={{ interaction: 'double-click' }}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
        />
      </Paper>
      {/* Collapsible RSVP Panel */}
      <Paper variant="outlined">
        <Box
          onClick={() => setPanelOpen((o) => !o)}
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            RSVP - Upcoming Non-PMT Events
            {rsvpableEvents.length > 0 && (
              <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                ({rsvpableEvents.length})
              </Typography>
            )}
          </Typography>
          {panelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>

        <Collapse in={panelOpen}>
          <Divider />
          {rsvpableEvents.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ px: 2, py: 1.5 }}>
              No upcoming Non-PMT events.
            </Typography>
          ) : (
            <Stack divider={<Divider />} sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {rsvpableEvents.map((event) => {
                const myStatus = rsvpStatus[event.id];
                const goers = rsvpGoers[event.id] ?? [];
                const busy = rsvpLoading[event.id] ?? false;

                return (
                  <Box
                    key={event.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.25,
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatEventTime(event.start, event.end)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="textSecondary">
                          {goers.length} going
                        </Typography>
                        {goers.length > 0 && (
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            sx={{ maxWidth: 200, display: 'block' }}
                          >
                            {goers.join(', ')}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant={myStatus === true ? 'contained' : 'outlined'}
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={() => handleRsvp(event.id, true)}
                        disabled={busy}
                        sx={{ minWidth: 88 }}
                      >
                        Going
                      </Button>
                      {/*<Button 
                          size='small'
                          variant={myStatus === false ? 'contained' : 'outlined'}
                          color='error'
                          startIcon={<CloseIcon />}
                          onClick={() => handleRsvp(event.id, false)}
                          disabled={busy}
                          sx={{ minWidth: 108 }}
                        >Not Going</Button>*/}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Collapse>
      </Paper>
    </Box>
  );
};

export default Events;
