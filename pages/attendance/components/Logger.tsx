import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useAppData } from '../../../firebase/AppDataContext';
import {
  saveAttendanceStatus,
  subscribeEventAttendance,
} from '../../../firebase/services/attendance';
import { fetchTodaysMandatoryEvents } from '../../../firebase/services/events';
import { useUser } from '../../../hooks/useUser';
import { AttendanceStatus, BASE_CYCLE, statusesForTitle } from '../../../lib/attendance';
import { FLIGHTS } from '../../../lib/constants';

interface EventOption {
  id: string;
  title: string;
}

interface UserRow {
  uid: string;
  displayName: string;
  classYear?: string;
  flight?: string;
}

export default function Logger() {
  const currentUser = useUser().userData;
  const { users: cachedUsers, usersLoading: cachedUsersLoading } = useAppData();

  const [todaysEvents, setTodaysEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [flightFilter, setFlightFilter] = useState<string>('All');

  // attendance[uid] = status or undefined (not yet logged)
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load today's mandatory events
  useEffect(() => {
    fetchTodaysMandatoryEvents()
      .then((events) => {
        setTodaysEvents(events.map((e) => ({ id: e.id, title: e.title })));
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load today's events");
      })
      .finally(() => setEventsLoading(false));
  }, []);

  // Sync users from cache
  useEffect(() => {
    setUsers(
      cachedUsers.map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        classYear: u.classYear,
        flight: u.flight,
      }))
    );
  }, [cachedUsers]);

  // Load attendance when event is selected
  useEffect(() => {
    if (!selectedEventId) return;
    const event = todaysEvents.find((e) => e.id === selectedEventId) ?? null;
    setSelectedEvent(event);
    setAttendance({});
    // Load existing attendance for this event
    const unsubAtt = subscribeEventAttendance(selectedEventId, (map) => {
      setAttendance((prev) => ({ ...prev, ...map }));
    });

    return () => {
      unsubAtt();
    };
  }, [selectedEventId]);

  const handleStatusChange = (uid: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [uid]: status }));
  };

  const handleSave = async () => {
    if (!selectedEventId || !currentUser) return;
    setSaving(true);
    setError(null);
    try {
      const entries = Object.entries(attendance).filter(([, s]) => s !== undefined);
      await Promise.all(
        entries.map(([uid, status]) =>
          saveAttendanceStatus(selectedEventId, uid, status as AttendanceStatus, currentUser.uid)
        )
      );
      setSuccess('Attendance saved');
    } catch (err) {
      console.error(err);
      setError('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers =
    flightFilter === 'All' ? users : users.filter((u) => u.flight === flightFilter);

  const statuses = selectedEvent ? statusesForTitle(selectedEvent.title) : BASE_CYCLE;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {eventsLoading ? (
        <CircularProgress size={24} />
      ) : (
        <FormControl sx={{ maxWidth: 360 }}>
          <InputLabel>Today's PMT Events</InputLabel>
          <Select
            value={selectedEventId}
            label="Today's PMT Events"
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {todaysEvents.length === 0 && (
              <MenuItem disabled value="">
                No PMT events today
              </MenuItem>
            )}
            {todaysEvents.map((ev) => (
              <MenuItem key={ev.id} value={ev.id}>
                {ev.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {selectedEventId && (
        <>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              Filter by flight:
            </Typography>
            <ButtonGroup size="small">
              {['All', ...FLIGHTS].map((f) => (
                <Button
                  key={f}
                  variant={flightFilter === f ? 'contained' : 'outlined'}
                  onClick={() => setFlightFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </ButtonGroup>
          </Box>

          {cachedUsersLoading ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Cadet</TableCell>
                    <TableCell>Class Year</TableCell>
                    <TableCell>Flight</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>{user.classYear ?? '-'}</TableCell>
                      <TableCell>{user.flight ?? '-'}</TableCell>
                      <TableCell>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={attendance[user.uid] ?? null}
                          onChange={(_, val) => val && handleStatusChange(user.uid, val)}
                        >
                          {statuses.map((s) => (
                            <ToggleButton key={s} value={s} sx={{ fontSize: '0.7rem', px: 1 }}>
                              {s}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </Button>
        </>
      )}
    </Box>
  );
}
