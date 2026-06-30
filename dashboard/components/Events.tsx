import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  Typography,
  Paper,
  Divider,
} from '@mui/material';
import { EventCalendar } from '@mui/x-scheduler';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useUser } from './hooks/useUser';
import { useSupervisorChain } from './hooks/useSupervisorChain';
import { useUserCache } from './hooks/useUserCache';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../firebase/AuthContext';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  mandatory?: boolean;
  createdBy: string;
  createdByName?: string;
}

interface RSVP {
  id?: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

const EventsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userJob } = useUser();
  const { canEditUserContent } = useSupervisorChain();
  const { getMultipleUsers } = useUserCache();
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rsvpMap, setRsvpMap] = useState<Map<string, RSVP[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [openEventForm, setOpenEventForm] = useState(false);
  const [openEventDetails, setOpenEventDetails] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [openRSVPList, setOpenRSVPList] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    mandatory: false,
    startDate: new Date(),
    endDate: new Date(Date.now() + 3600000), // 1 hour later
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userRsvpStatus, setUserRsvpStatus] = useState<Map<string, boolean>>(new Map());

  // Check if current user can manage events
  const canManageEvents = userJob?.permissions?.includes('manage_events') ?? false;

  // Fetch events and RSVPs
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(collection(db, 'events'), async (snapshot) => {
      try {
        const eventsData: CalendarEvent[] = [];
        const creatorIds = new Set<string>();

        // First pass: collect all creator IDs and basic event data
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          creatorIds.add(data.createdBy);

          const startDate = data.startDate?.toDate?.() || new Date(data.date);
          const endDate = data.endDate?.toDate?.() || new Date(startDate.getTime() + 3600000);
          eventsData.push({
            id: docSnap.id,
            title: data.title,
            description: data.description,
            startDate,
            endDate,
            location: data.location,
            mandatory: data.mandatory,
            createdBy: data.createdBy,
          });
        }

        // Batch fetch all creator names
        const userMap = await getMultipleUsers(Array.from(creatorIds));
        eventsData.forEach((event) => {
          event.createdByName = userMap.get(event.createdBy)?.displayName || event.createdBy;
        });

        setEvents(eventsData);

        // Fetch RSVPs for all events
        const rsvpMapTemp = new Map<string, RSVP[]>();
        const userRsvpStatusTemp = new Map<string, boolean>();
        const allRsvpUserIds = new Set<string>();

        // First pass: collect all user IDs from RSVPs
        for (const event of eventsData) {
          const rsvpsSnap = await getDocs(collection(db, 'events', event.id, 'rsvps'));
          rsvpsSnap.docs.forEach((doc) => allRsvpUserIds.add(doc.data().userId));
        }

        // Batch fetch all RSVP user names
        const userNamesMap = await getMultipleUsers(Array.from(allRsvpUserIds));

        // Second pass: populate RSVP with user names
        for (const event of eventsData) {
          const rsvpsSnap = await getDocs(collection(db, 'events', event.id, 'rsvps'));
          const rsvps: RSVP[] = [];
          
          for (const rsvpDoc of rsvpsSnap.docs) {
            const rsvpData = rsvpDoc.data();
            const userName = userNamesMap.get(rsvpData.userId)?.displayName || rsvpData.userId;
            rsvps.push({
              id: rsvpDoc.id,
              userId: rsvpData.userId,
              userName,
              timestamp: rsvpData.timestamp?.toDate?.() || new Date(rsvpData.timestamp),
            });
            
            if (rsvpData.userId === currentUser.uid) {
              userRsvpStatusTemp.set(event.id, true);
            }
          }
          rsvpMapTemp.set(event.id, rsvps);
        }

        setRsvpMap(rsvpMapTemp);
        setUserRsvpStatus(userRsvpStatusTemp);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events');
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [currentUser, getMultipleUsers]);

  // Check if user can edit an event
  const canEditEvent = useCallback(
    async (event: CalendarEvent): Promise<boolean> => {
      if (!currentUser) return false;
      return await canEditUserContent(currentUser.uid, event.createdBy);
    },
    [currentUser, canEditUserContent]
  );

  // Handle create new event
  const handleCreateEvent = async () => {
    if (!currentUser || !formData.title) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await addDoc(collection(db, 'events'), {
        title: formData.title,
        description: formData.description || '',
        date: formData.startDate,
        location: formData.location || '',
        mandatory: formData.mandatory || false,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      setOpenEventForm(false);
      setFormData({
        title: '',
        description: '',
        location: '',
        mandatory: false,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
      });
      setError(null);
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event');
    }
  };

  // Handle update event
  const handleUpdateEvent = async () => {
    if (!selectedEvent || !formData.title) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await updateDoc(doc(db, 'events', selectedEvent.id), {
        title: formData.title,
        description: formData.description || '',
        date: formData.startDate,
        location: formData.location || '',
        mandatory: formData.mandatory || false,
      });

      setOpenEventForm(false);
      setSelectedEvent(null);
      setFormData({
        title: '',
        description: '',
        location: '',
        mandatory: false,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
      });
      setError(null);
    } catch (err) {
      console.error('Error updating event:', err);
      setError('Failed to update event');
    }
  };

  // Handle delete event
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      await deleteDoc(doc(db, 'events', selectedEvent.id));
      setOpenDeleteConfirm(false);
      setOpenEventDetails(false);
      setSelectedEvent(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event');
    }
  };

  // Handle RSVP toggle
  const handleRSVPToggle = async (event: CalendarEvent) => {
    if (!currentUser) return;

    try {
      const isRsvped = userRsvpStatus.get(event.id);

      if (isRsvped) {
        // Remove RSVP
        const rsvpsSnap = await getDocs(
          query(collection(db, 'events', event.id, 'rsvps'), where('userId', '==', currentUser.uid))
        );
        for (const rsvpDoc of rsvpsSnap.docs) {
          await deleteDoc(rsvpDoc.ref);
        }
      } else {
        // Add RSVP
        await addDoc(collection(db, 'events', event.id, 'rsvps'), {
          userId: currentUser.uid,
          timestamp: serverTimestamp(),
        });
      }

      setUserRsvpStatus((prev) => new Map(prev).set(event.id, !isRsvped));
    } catch (err) {
      console.error('Error toggling RSVP:', err);
      setError('Failed to update RSVP');
    }
  };

  // Handle open event edit
  const handleOpenEdit = async (event: CalendarEvent) => {
    const hasPermission = await canEditEvent(event);
    if (!hasPermission) {
      setError('You do not have permission to edit this event');
      return;
    }
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location || '',
      mandatory: event.mandatory || false,
    });
    setOpenEventForm(true);
    setAnchorEl(null);
  };

  // Handle open event details
  const handleOpenDetails = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setOpenEventDetails(true);
    setAnchorEl(null);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, clickedEvent: CalendarEvent) => {
    setSelectedEvent(clickedEvent);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEventClick = (calendarEvent: CalendarEvent) => {
    handleOpenDetails(calendarEvent);
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Events Calendar
        </Typography>
        {canManageEvents && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setSelectedEvent(null);
              setFormData({
                title: '',
                description: '',
                location: '',
                mandatory: false,
                startDate: new Date(),
                endDate: new Date(Date.now() + 3600000),
              });
              setOpenEventForm(true);
            }}
          >
            Create Event
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Event Calendar */}
      <Paper sx={{ flex: 1, overflow: 'auto' }}>
        <EventCalendar
          events={events}
          onEventsChange={(updatedEvents: CalendarEvent[]) => {
            setEvents(updatedEvents);
          }}
          sx={{ height: '100%' }}
        />
      </Paper>

      {/* Create/Edit Event Modal */}
      <Dialog open={openEventForm} onClose={() => setOpenEventForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedEvent ? 'Edit Event' : 'Create New Event'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Event Title"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Start Date & Time"
            type="datetime-local"
            fullWidth
            value={formData.startDate.toISOString().slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Location"
            fullWidth
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.mandatory}
                onChange={(e) => setFormData({ ...formData, mandatory: e.target.checked })}
              />
            }
            label="Mandatory Event"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEventForm(false)}>Cancel</Button>
          <Button
            onClick={selectedEvent ? handleUpdateEvent : handleCreateEvent}
            variant="contained"
            color="primary"
          >
            {selectedEvent ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Details Modal */}
      <Modal open={openEventDetails} onClose={() => setOpenEventDetails(false)}>
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: '500px' },
            maxHeight: '90vh',
            overflow: 'auto',
            p: 3,
          }}
        >
          {selectedEvent && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {selectedEvent.title}
                  </Typography>
                  {selectedEvent.mandatory && (
                    <Chip label="Mandatory" color="error" size="small" sx={{ mt: 1 }} />
                  )}
                </Box>
                <Box>
                  {canManageEvents && (
                    <IconButton
                      onClick={(e) => handleMenuClick(e, selectedEvent)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Date & Time
                </Typography>
                <Typography>
                  {selectedEvent.startDate.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Location
                </Typography>
                <Typography>{selectedEvent.location || 'TBA'}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Description
                </Typography>
                <Typography>{selectedEvent.description || 'No description provided'}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Created By
                </Typography>
                <Typography>{selectedEvent.createdByName || selectedEvent.createdBy}</Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* RSVP Section */}
              {!selectedEvent.mandatory && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    fullWidth
                    variant={userRsvpStatus.get(selectedEvent.id) ? 'contained' : 'outlined'}
                    color="primary"
                    startIcon={
                      userRsvpStatus.get(selectedEvent.id) ? <CheckCircleIcon /> : undefined
                    }
                    onClick={() => handleRSVPToggle(selectedEvent)}
                  >
                    {userRsvpStatus.get(selectedEvent.id) ? "RSVP'd" : 'RSVP'}
                  </Button>
                </Box>
              )}

              {/* RSVP List */}
              <Box>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setOpenRSVPList(true)}
                  sx={{ mb: 2 }}
                >
                  View RSVPs ({rsvpMap.get(selectedEvent.id)?.length || 0})
                </Button>
              </Box>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => setOpenEventDetails(false)}
              >
                Close
              </Button>
            </>
          )}
        </Paper>
      </Modal>

      {/* RSVP List Modal */}
      <Dialog open={openRSVPList} onClose={() => setOpenRSVPList(false)} maxWidth="sm" fullWidth>
        <DialogTitle>RSVPs - {selectedEvent?.title}</DialogTitle>
        <DialogContent>
          {rsvpMap.get(selectedEvent?.id!)?.length ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              {rsvpMap.get(selectedEvent?.id!)?.map((rsvp) => (
                <Chip
                  key={rsvp.id}
                  label={rsvp.userName}
                  variant="outlined"
                  sx={{ justifyContent: 'flex-start' }}
                />
              ))}
            </Box>
          ) : (
            <Typography color="textSecondary">No one has RSVP'd yet</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRSVPList(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Event Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => selectedEvent && handleOpenEdit(selectedEvent)}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => setOpenDeleteConfirm(true)}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Modal */}
      <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={handleDeleteEvent} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsPage;
