import React, { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    Switch,
    TextField,
    Typography
} from '@mui/material';
import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useAuth } from '../../../firebase/AuthContext';

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function EventsTab() {
    const { currentUser } = useAuth();
    const [eventName, setEventName] = useState('');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('07:00');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [mandatory, setMandatory] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [deletingPast, setDeletingPast] = useState(false);
    const [openDeletePastConfirm, setOpenDeletePastConfirm] = useState(false);

    const handleDeletePastEvents = async () => {
        setOpenDeletePastConfirm(false);
        setDeletingPast(true);
        try {
            const now = Timestamp.now();
            const snap = await getDocs(query(collection(db, 'events'), where('endDate', '<', now)));
            const BATCH_SIZE = 499;
            for(let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            setSuccess(`Deleted ${snap.docs.length} event(s)`);
        } catch (err) {
            console.error(err);
            setError('Failed to delete past events');
        } finally {
            setDeletingPast(false);
        }
    };

    const toggleDay = (day: number) => {
        setSelectedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleCreate = async () => {
        if(!eventName.trim()) { setError('Event name is required'); return; }
        if(selectedDays.length === 0) { setError('Select at least one day'); return; }
        if(!startDate || !endDate) { setError('Start and end dates are required'); return; }
        if(startTime >= endTime) { setError('End time must be after start time'); return; }

        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        if (start > end) { setError('End date must be after start date'); return; }
        
        setLoading(true);
        setError(null);

        try {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);

            const occurrences: Date[] = [];
            const cursor = new Date(start);
            while (cursor <= end) {
                if (selectedDays.includes(cursor.getDay())) {
                    occurrences.push(new Date(cursor));
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            if (occurrences.length === 0) {
                setError('No occurrences found in that date range for the selected days');
                setLoading(false);
                return;
            }

            // Firestore batch limit is 500; split if needed
            const BATCH_SIZE = 499;
            for (let i = 0; i < occurrences.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = occurrences.slice(i, i + BATCH_SIZE);
                for (const date of chunk) {
                    const startDt = new Date(date);
                    startDt.setHours(startH, startM, 0, 0);
                    const endDt = new Date(date);
                    endDt.setHours(endH, endM, 0, 0);

                    batch.set(doc(collection(db, 'events')), {
                        title: eventName.trim(),
                        description: '',
                        startDate: Timestamp.fromDate(startDt),
                        endDate: Timestamp.fromDate(endDt),
                        mandatory,
                        createdBy: currentUser?.uid ?? '',
                        createdAt: serverTimestamp(),
                    });
                }
                await batch.commit();
            }

            setSuccess(`Created ${occurrences.length} event(s)`)
            setEventName('');
            setSelectedDays([]);
            setStartDate('');
            setEndDate('');
            setMandatory(false);
        } catch (err) {
            console.error(err);
            setError('Failed to create events');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity='success' onClose={() => setSuccess(null)}>{success}</Alert>}

            <Typography variant='h6'>Create Repeating Event</Typography>

            <TextField
                label='Event Name'
                fullWidth
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
            />

            <FormControl component='fieldset'>
                <FormLabel component='legend'>Days of Week</FormLabel>
                <FormGroup row>
                    {DAYS.map((d) => (
                        <FormControlLabel
                            key={d.value}
                            control={
                                <Checkbox
                                checked={selectedDays.includes(d.value)}
                                onChange={() => toggleDay(d.value)}
                                size='small'
                            />
                            }
                            label={d.label}
                        />
                    ))}
                </FormGroup>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                    label='Start Time'
                    type='time'
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flex: 1 }}
                />
                <TextField
                    label='End Time'
                    type='time'
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flex: 1 }}
                />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                    label='Start Date'
                    type='date'
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flex: 1 }}
                />
                <TextField
                    label='End Date'
                    type='date'
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ flex: 1 }}
                />
            </Box>

            <FormControlLabel
                control={<Switch checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />}
                label='Mandatory'
            />

            <Button
                variant='contained'
                onClick={handleCreate}
                disabled={loading}
                sx={{ alignSelf: 'flex-start' }}
            >
                {loading ? 'Creating...' : 'Create Events'}
            </Button>

            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                <Typography variant='h6' sx={{ mb: 1 }}>Maintanence</Typography>
                <Button
                    variant='outlined'
                    color='error'
                    onClick={() => setOpenDeletePastConfirm(true)}
                    disabled={deletingPast}
                >
                    {deletingPast ? 'Deleting...' : 'Delete All Past Events'}
                </Button>
            </Box>

            {/* Delete past events confirm */}
            <Dialog open={openDeletePastConfirm} onClose={() => setOpenDeletePastConfirm(false)}>
                <DialogTitle>Delete ALL Past Events?</DialogTitle>
                <DialogContent>
                    <Typography>This will permanently delete all events whose end time has already passed. This cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeletePastConfirm(false)}>Cancel</Button>
                    <Button onClick={handleDeletePastEvents} color='error' variant='contained'>Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}