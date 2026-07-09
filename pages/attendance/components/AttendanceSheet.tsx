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
import { useEffect, useState } from 'react';
import { useAppData } from '../../../firebase/AppDataContext';
import { fetchAllAttendance, saveAttendanceStatus } from '../../../firebase/services/attendance';
import { fetchMandatoryEvents } from '../../../firebase/services/events';
import { useUser } from '../../../hooks/useUser';
import {
    absencesRemainingFromStatuses,
    AttendanceStatus,
    cycleFor,
    EVENT_TYPES,
    EventType,
    eventTypeFromTitle,
    nextStatus,
    STATUS_COLORS
} from '../../../lib/attendance';

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

function formatColDate(d: Date): string {
    return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export default function AttendanceSheet() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const currentUser = useUser().userData;
    const { users: cachedUsers } = useAppData();

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
            const range = {
                start: startDate ? new Date(startDate + 'T00:00:00') : undefined,
                end: endDate ? new Date(endDate + 'T23:59:59') : undefined,
            };

            const typeEvents: EventDoc[] = (await fetchMandatoryEvents(range))
                .filter((e) => eventTypeFromTitle(e.title) === type)
                .map((e) => ({ id: e.id, title: e.title, startDate: e.startDate }));

            setEvents(typeEvents);

            setUsers(cachedUsers.map((u) => ({ uid: u.uid, displayName: u.displayName, classYear: u.classYear })));

            // Load attendance for each event
            const typeEventIds = new Set(typeEvents.map((e) => e.id));
            const attMap: Record<string, AttendanceRecord> = {};
            (await fetchAllAttendance()).forEach(({ eventId, userId, status }) => {
                if (!typeEventIds.has(eventId)) return;
                if (!attMap[userId]) attMap[userId] = {};
                attMap[userId][eventId] = status;
            });
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
            await saveAttendanceStatus(eventId, uid, next, currentUser.uid);
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
                                const absLeft = absencesRemainingFromStatuses(statuses);
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