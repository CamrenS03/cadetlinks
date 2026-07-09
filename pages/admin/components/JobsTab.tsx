import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    serverTimestamp,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAppData } from '../../../firebase/AppDataContext';
import { db } from '../../../firebase/firebase';

interface Job {
    id: string;
    title: string;
    permissions: string[];
    parentJobId?: string;
    childJobIds?: string[];
}

const All_PERMISSIONS = [
    'admin',
    'manage_announcements',
    'manage_attendance',
    'manage_documents',
    'manage_events',
    'manage_pt_scores'
];

const PERMISSION_LABELS: Record<string, string> = {
    admin: 'Admin',
    manage_announcements: 'Announcements',
    manage_attendance: 'Attendance',
    manage_documents: 'Documents',
    manage_events: 'Events',
    manage_pt_scores: 'PT Scores'
};

export default function JobsTab() {
    const { jobs: cachedJobs, refreshJobs } = useAppData();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editTitles, setEditTitles] = useState<Record<string, string>>({});
    const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
    const [newJobTitle, setNewJobTitle] = useState('');

    useEffect(() => {
        const loaded = cachedJobs.map((j) => ({ ...j } as Job));
        setJobs(loaded);
        setEditTitles(Object.fromEntries(loaded.map((j) => [j.id, j.title])));
    }, [cachedJobs]);


    const handleTitleBlur = async (job: Job) => {
        const newTitle = editTitles[job.id]?.trim();
        if(!newTitle || newTitle === job.title) return;
        try {
            await updateDoc(doc(db, 'jos', job.id), { title: newTitle });
            refreshJobs();
        } catch (err) {
            console.error(err);
            setError('Failed to rename job');
        }
    };

    const handlePermissionToggle = async (job: Job, permission: string) => {
        const current = job.permissions ?? [];
        const updated = current.includes(permission)
            ? current.filter((p) => p !== permission)
            : [...current, permission];
        try {
            await updateDoc(doc(db, 'jobs', job.id), { permissions: updated });
            refreshJobs();
        } catch (err) {
            console.error(err);
            setError('Failed to update permissions');
        }
    };

    const handleParentChange = async (job: Job, newParentId: string) => {
        const oldParentId = job.parentJobId ?? '';
        if (newParentId === oldParentId) return;

        const batch = writeBatch(db);

        batch.update(doc(db, 'jobs', job.id), {parentJobId: newParentId || '' });

        if (oldParentId) {
            const oldParent = jobs.find((j) => j.id === oldParentId);
            if (oldParent) {
                batch.update(doc(db, 'jobs', oldParentId), {
                    childJobIds: (oldParent.childJobIds ?? []).filter((id) => id !== job.id)
                });
            }
        }

        if (newParentId) {
            const newParent = jobs.find((j) => j.id === newParentId);
            if (newParent) {
                const existing = newParent.childJobIds ?? [];
                if (!existing.includes(job.id)) {
                    batch.update(doc(db, 'jobs', newParentId), {
                        childJobIds: [...existing, job.id]
                    })
                }
            }
        }

        try {
            await batch.commit();
            refreshJobs();
        } catch (err) {
            console.error(err);
            setError('Failed to update parent job');
        }
    };
    
    const handleAddJob = async () => {
        if(!newJobTitle.trim()) return;
        try {
            await addDoc(collection(db, 'jobs'), {
                title: newJobTitle.trim(),
                permissions: [],
                parentJobId: '',
                childJobIds: [],
                createdAt: serverTimestamp()
            });
            setNewJobTitle('');
            refreshJobs();
        } catch (err) {
            console.error(err);
            setError('Failed to add job');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, 'jobs', deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            console.error(err);
            setError('Failed to delete job');
        }
    };

    const childTitles = (job: Job) =>
        (job.childJobIds ?? [])
            .map((id) => jobs.find((j) => j.id === id)?.title)
            .filter(Boolean)
            .join(', ') || '-';

    const sorted = [...jobs].sort((a, b) => a.title.localeCompare(b.title));

    return (
        <Box>
            {error && <Alert severity='error' onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer sx={{ maxheight: '60vh', overflowY: 'auto' }}>
                <Table size='small' stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ minWidth: 160 }}>Title</TableCell>
                            <TableCell sx={{ minWidth: 160 }}>Supervisor</TableCell>
                            <TableCell sx={{ minWidth: 200 }}>Supervisees</TableCell>
                            {All_PERMISSIONS.map((p) => (
                                <TableCell key={p} align='center' sx={{ whiteSpace: 'nowrap' }}>
                                    {PERMISSION_LABELS[p]}
                                </TableCell>
                            ))}
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sorted.map((job) => (
                            <TableRow key={job.id}>
                                <TableCell>
                                    <TextField
                                        size='small'
                                        value={editTitles[job.id] ?? job.title}
                                        onChange={(e) =>
                                            setEditTitles((t) => ({ ...t, [job.id]: e.target.value }))
                                        }
                                        onBlur={() => handleTitleBlur(job)}
                                        variant='standard'
                                        sx={{ minWidth: 140 }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Select
                                        size='small'
                                        value={job.parentJobId ?? ''}
                                        onChange={(e) => handleParentChange(job, e.target.value)}
                                        displayEmpty
                                        variant='standard'
                                        sx={{ minWidth: 140 }}
                                    >
                                        <MenuItem value=''><em>None</em></MenuItem>
                                        {sorted
                                            .filter((j) => j.id !== job.id)
                                            .map((j) => (
                                                <MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>
                                            ))}
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Typography variant='body2' color='textSecondary'>{childTitles(job)}</Typography>
                                </TableCell>
                                {All_PERMISSIONS.map((p) => (
                                    <TableCell key={p} align='center' padding='checkbox'>
                                        <Checkbox
                                            size='small'
                                            checked={(job.permissions ?? []).includes(p)}
                                            onChange={() => handlePermissionToggle(job, p)}
                                        />
                                    </TableCell>
                                ))}
                                <TableCell>
                                    <Tooltip title='Delete Job'>
                                        <IconButton size='small' color='error' onClick={() => setDeleteTarget(job)}>
                                            <DeleteIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {/* Add new job row */}
                        <TableRow>
                            <TableCell colSpan={All_PERMISSIONS.length + 4}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <TextField
                                        size='small'
                                        placeholder='New job title...'
                                        value={newJobTitle}
                                        onChange={(e) => setNewJobTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddJob()}
                                        sx={{ flex: 1 }}
                                    />
                                    <Button
                                        size='small'
                                        variant='contained'
                                        startIcon={<AddIcon />}
                                        onClick={handleAddJob}
                                    >
                                        Add Job
                                    </Button>
                                </Box>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete "{deleteTarget?.title}"?</DialogTitle>
                <DialogContent>
                    <Typography> This will remove the job. Users holding it will keep their data but lose the job reference and permissions.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button onClick={handleDelete} color='error' variant='contained'>Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}