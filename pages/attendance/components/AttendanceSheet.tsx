import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useUser } from '../../../hooks/useUser';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | 'Voluntarily Present';

const EVENT_TYPES = ['PT', 'LLAB', 'RMP'] as const;
type EventType = typeof EVENT_TYPES[number];

const BASE_CYCLE: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];
const RMP_CYCLE: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused', 'Voluntarily Present'];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
    Present: '#2e7d32',
    Absent: '#c62828',
    Late: '#f9a825',
    Excused: '#81c784',
    'Voluntarily Present': '#1565c0'
};

const CLASS_YEAR_ORDER = ['100', '150', '200', '250', '300', '400'];

const CLASS_COLOR: Record<string, string> = {
    100: '#13e1e8',
    150: '#1375e8',
    200: '#5e59f7',
    250: '#1a13e8',
    300: '#e81a13',
    400: '#ac9201'
}

interface EventDoc {
    id: string;
    title: string;
    startDate: Date;
}

interface UserRow {
    uid: string;
    displayName: string;
    classYear?: string;
}

interface AttendanceRecord {
    [eventId: string]: AttendanceStatus | undefined;
}

function cycleFor(eventType: EventType): AttendanceStatus[] {
    return eventType === 'RMP' ? RMP_CYCLE : BASE_CYCLE;
}

function nextStatus(current: AttendanceStatus | undefined, cycle: AttendanceStatus[]): AttendanceStatus {
    if (!current) return cycle[0];
    const idx = cycle.indexOf(current);
    return cycle[(idx + 1) % cycle.length];
}

function calcAbsencesRemaining(records: (AttendanceStatus | undefined)[]): string {
    const total = records.length;
    if (total === 0) return '-';
    const allowed = Math.floor(total * 0.2 * 2) / 2;
    const used = records.reduce((acc, s) => {
        if (s === 'Absent') return acc + 1;
        if (s === 'Late') return acc + 0.5;
        return acc;
    }, 0);
    const remaining = allowed - used;
    return remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1);
}

function formatColDate(d: Date): string {
    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export default function AttendanceSheet() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const currentUser = useUser().userData;

    const [activeType, setActiveType] = useState<EventType>('PT');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [events, setEvents] = useState<EventDoc[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    // attendance[uid][eventId] = status
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async (type: EventType) => {
        setLoading(true);
        setError(null);
        try {
            // Build event query
            const constraints: any[] = [where('mandatory', '==', true)];
            if (startDate) constraints.push(where('startDate', '>=', Timestamp.fromDate(new Date(startDate + 'T00:00:00'))));
            if (endDate) constraints.push(where('startDate', '<=', Timestamp.fromDate(new Date(endDate + 'T23:59:59'))));

            const eventsSnap = await getDocs(query(collection(db, 'events'), ...constraints));
            const typeEvents: EventDoc[] = eventsSnap.docs
                .filter((d) => (d.data().title as string).trim().toUpperCase() === type)
                .map((d) => ({
                    id: d.id,
                    title: d.data().title,
                    startDate: (d.data().startDate as Timestamp).toDate(),
                }))
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

            setEvents(typeEvents);

            // Load users
            const usersSnap = await getDocs(collection(db, 'users'));
            const loadedUsers: UserRow[] = usersSnap.docs.map((d) => ({
                uid: d.id,
                displayName: d.data(). displayName ?? d.data().email ?? d.id,
                classYear: d.data().classYear,
            }));
            loadedUsers.sort((a, b) => {
                const cy = CLASS_YEAR_ORDER.indexOf(b.classYear ?? '') - CLASS_YEAR_ORDER.indexOf(a.classYear ?? '');
                return cy !== 0 ? cy : a.displayName.localeCompare(b.displayName); 
            });
            setUsers(loadedUsers);

            // Load attendance for each event
            const attMap: Record<string, AttendanceRecord> = {};
            await Promise.all(
                typeEvents.map(async (ev) => {
                    const attSnap = await getDocs(collection(db, 'events', ev.id, 'attendance'));
                    attSnap.docs.forEach((d) => {
                        const uid = d.id;
                        if (!attMap[uid]) attMap[uid] = {};
                        attMap[uid][ev.id] = d.data().status as AttendanceStatus | undefined;
                    });
                })
            );
            setAttendance(attMap);
        } catch (err) {
            console.error(err);
            setError('Failed to load attendance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(activeType);
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeType]);

    const handleCellClick = async (uid: string, eventId: string) => {
        if (!currentUser) return;
        const cycle = cycleFor(activeType);
        const current = attendance[uid]?.[eventId];
        const next = nextStatus(current, cycle);

        setAttendance((prev) => ({
            ...prev,
            [uid]: { ...(prev[uid] ?? {}), [eventId]: next },
        }));

        try {
            await setDoc(doc(db, 'events', eventId, 'attendance', uid), {
                userId: uid,
                status: next,
                takenById: currentUser.uid,
            });
        } catch (err) {
            console.error(err);
            setError('Failed to save status change');
            // revert
            setAttendance((prev) => ({
                ...prev,
                [uid]: { ...(prev[uid] ?? {}), [eventId]: current },
            }));
        }
    };

    if (isMobile) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant='h6' gutterBottom>Screen Too Small</Typography>
                <Typography variant='body2' color='textSecondary'>The attendance sheet is best viewed on a tablet or larger device. Please switch to a larger screen.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>}

            <Tabs value={activeType} onChange={(_, v) => setActiveType(v as EventType)}>
                {EVENT_TYPES.map((t) => <Tab key={t} label={t} value={t} />)}
            </Tabs>

            {/* Date range filter */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    label='From'
                    type='date'
                    size='small'
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 160 }}
                />
                <TextField
                    label='To'
                    type='date'
                    size='small'
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 160 }}
                />
                <Button variant='outlined' size='small' onClick={() => fetchData(activeType)}>Apply</Button>
                <Button size='small' onClick={() => { setStartDate(''); setEndDate(''); fetchData(activeType); }}>Clear</Button>
            </Box>

            {loading ? (
                <CircularProgress size={28} />
            ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size='small' stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ minWidth: 180, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper' }}>Cadet</TableCell>
                                <TableCell sx={{ minWidth: 70 }}>Abs. Left</TableCell>
                                {events.map((ev) => (
                                    <TableCell key={ev.id} align='center' sx={{ minWidth: 56, whiteSpace: 'nowrap' }}>{formatColDate(ev.startDate)}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => {
                                const userAtt = attendance[user.uid] ?? {};
                                const statuses = events.map((ev) => userAtt[ev.id]);
                                const absLeft = calcAbsencesRemaining(statuses);
                                const absLeftNum = parseFloat(absLeft);

                                return (
                                    <TableRow key={user.uid} hover>
                                        <TableCell sx={{ 
                                            position: 'sticky', 
                                            left: 0, 
                                            zIndex: 1, 
                                            bgcolor: user.classYear ? CLASS_COLOR[user.classYear] : 'background.paper', 
                                            fontWeight: 500
                                        }}>
                                            {user.displayName}
                                        </TableCell>
                                        <TableCell>
                                            <Typography 
                                                variant='body2' 
                                                sx={{ color: absLeft === '-' ? 'textSecondary' : absLeftNum <= 0 ? 'error.main' : absLeftNum <= 1 ? 'warning.main' : 'text.primary' }}
                                            >{absLeft}</Typography>
                                        </TableCell>
                                        {events.map((ev) => {
                                            const status = userAtt[ev.id];
                                            return (
                                                <TableCell key={ev.id} align='center' padding='none'>
                                                    <Tooltip title={status ?? 'Not Logged'} placement='top'>
                                                        <Button onClick={() => handleCellClick(user.uid, ev.id)}
                                                        sx={{
                                                            minWidth: 48,
                                                            height: 32,
                                                            borderRadius: 0,
                                                            bgcolor: status ? STATUS_COLORS[status] : 'transparent',
                                                            color: status ? '#fff' : 'textDisabled',
                                                            fontSize: '0.65rem',
                                                            '&:hover': {
                                                                bgcolor: status
                                                                    ? STATUS_COLORS[status]
                                                                    : 'action.hover',
                                                                opacity: 0.85,
                                                            },
                                                        }}
                                                        >{status ? status.charAt(0) : '·'}</Button>
                                                    </Tooltip>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                            {users.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={events.length + 2} align='center'>
                                        <Typography variant='body2' color='textSecondary'>No Data</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}