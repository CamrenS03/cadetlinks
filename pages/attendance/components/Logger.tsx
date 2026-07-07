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
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    Timestamp,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../../firebase/firebase';
import { useUser } from '../../../hooks/useUser';

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

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | 'Voluntarily Present';

const BASE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];
const RMP_STATUSES: AttendanceStatus[] = [...BASE_STATUSES, 'Voluntarily Present'];
const FLIGHTS = ['Alpha', 'Bravo', 'POC'];
const CLASS_YEAR_ORDER = ['100', '150', '200', '250', '300', '400'];

function statusesFor(eventTitle: string): AttendanceStatus[] {
    return eventTitle.trim().toUpperCase() === 'RMP' ? RMP_STATUSES : BASE_STATUSES;
}

export default function Logger() {
    const currentUser = useUser().userData;

    const [todaysEvents, setTodaysEvents] = useState<EventOption[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);

    const [users, setUsers] = useState<UserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [flightFilter, setFlightFilter] = useState<string>('All');

    // attendance[uid] = status or undefined (not yet logged)
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | undefined>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Load today's mandatory events
    useEffect(() => {
        const now = new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        getDocs(
            query(
                collection(db, 'events'),
                where('mandatory', '==', true),
                where('startDate', '>=', Timestamp.fromDate(dayStart)),
                where('startDate', '<=', Timestamp.fromDate(dayEnd))
            )
        )
            .then((snap) => {
                console.log('[loadEvents] About to set todays events');
                setTodaysEvents(
                    snap.docs.map((d) => ({ id: d.id, title: d.data().title as string }))
                );
            })
            .catch((err) => { console.error(err); setError('Failed to load today\'s events') })
            .finally(() => setEventsLoading(false));
    }, []);

    // Load users when event is selected
    useEffect(() => {
        if(!selectedEventId) return;
        const event = todaysEvents.find((e) => e.id === selectedEventId) ?? null;
        setSelectedEvent(event);
        setAttendance({});
        setUsersLoading(true);

        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
            const loaded: UserRow[] = snap.docs.map((d) => ({
                uid: d.id,
                displayName: d.data().displayName ?? d.data().email ?? d.id,
                classYear: d.data().classYear,
                flight: d.data().flight
            }));
            loaded.sort((a, b) => {
                const cy = CLASS_YEAR_ORDER.indexOf(b.classYear ?? '') - CLASS_YEAR_ORDER.indexOf(a.classYear ?? '');
                if (cy !== 0) return cy;
                return a.displayName.localeCompare(b.displayName);
            });
            setUsers(loaded);
            setUsersLoading(false);
        });

        // Load existing attendance for this event
        const unsubAtt = onSnapshot(
            collection(db, 'events', selectedEventId, 'attendance'),
            (snap) => {
                const map: Record<string, AttendanceStatus | undefined> = {};
                snap.docs.forEach((d) => {
                    map[d.id] = d.data().status as AttendanceStatus | undefined;
                });
                setAttendance((prev) => ({ ...prev, ...map }));
            }
        );

        return () => { unsubUsers(); unsubAtt(); };
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
                    setDoc(doc(db, 'events', selectedEventId, 'attendance', uid), {
                        userId: uid,
                        status,
                        takenById: currentUser.uid
                    })
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

    const filteredUsers = flightFilter === 'All'
        ? users
        : users.filter((u) => u.flight === flightFilter);

    const statuses = selectedEvent ? statusesFor(selectedEvent.title) : BASE_STATUSES;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity='success' onClose={() => setSuccess(null)}>{success}</Alert>}

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
                            <MenuItem disabled value=''>No PMT events today</MenuItem>
                        )}
                        {todaysEvents.map((ev) => (
                            <MenuItem key={ev.id} value={ev.id}>{ev.title}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {selectedEventId && (
                <>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant='body2' color='textSecondary'>Filter by flight:</Typography>
                        <ButtonGroup size='small'>
                            {['All', ...FLIGHTS].map((f) => (
                                <Button
                                    key={f}
                                    variant={flightFilter === f ? 'contained' : 'outlined'}
                                    onClick={() => setFlightFilter(f)}
                                >{f}</Button>
                            ))}
                        </ButtonGroup>
                    </Box>

                    {usersLoading ? (
                        <CircularProgress size={24} />
                    ) : (
                        <TableContainer>
                            <Table size='small'>
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
                                                    size='small'
                                                    exclusive
                                                    value={attendance[user.uid] ?? null}
                                                    onChange={(_, val) => val && handleStatusChange(user.uid, val)}
                                                >
                                                    {statuses.map((s) => (
                                                        <ToggleButton key={s} value={s} sx={{ fontSize: '0.7rem', px: 1 }}>{s}</ToggleButton>
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
                        variant='contained'
                        onClick={handleSave}
                        disabled={saving}
                        sx={{ alignSelf: 'flex-start', mt: 1 }}
                    >{saving ? 'Saving...' : 'Save Attendance'}</Button>
                </>
            )}
        </Box>
    );
}