import React, { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebase';

interface UserRow {
    id: string;
    displayName: string;
    email: string;
    flight?: string;
    rank?: string;
    classYear?: string;
    jobId?: string;
    supervisorIds: string[];
    superviseeIds: string[];
}

interface Job {
    id: string;
    title: string;
    parentJobId: string;
    childJobIds: string[];
}

const FLIGHTS = ['Alpha', 'Bravo', 'POC'];
const CLASS_YEARS = ['100', '150', '200', '250', '300', '400'];

const rankForYear = (year: string) => {
    if (year === '100' || year === '150') return 'C/4C';
    if (year === '200' || year === '250') return 'C/3C';
    return '';
};

const nextClassYear = (year: string) => {
    if (year === '100' || year === '150') return '200';
    if (year === '200' || year === '250') return '300';
    if (year === '300') return '400';
    if (year === '400') return 'special';
    return year;
};

const nextRank = (rank: string) => {
    if (rank === 'C/4C') return 'C/3C';
    if (rank === 'C/3C') return 'C/Lt';
    return rank;
};

export default function UsersTab() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Edit dialog
    const [editUser, setEditUser] = useState<UserRow | null>(null);
    const [editForm, setEditForm] = useState<Partial<UserRow>>({});

    // Add user dialog
    const [openAdd, setOpenAdd] = useState(false);
    const [addForm, setAddForm] = useState({ displayName: '', email: '', classYear: '100', flight: 'Alpha' });

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

    // Promote
    const [openPromoteConfirm, setOpenPromoteConfirm] = useState(false);
    const [graduatingCadets, setGraduatingCadets] = useState<UserRow[]>([]);
    const [keepMap, setKeepMap] = useState<Record<string, boolean>>({});
    const [openGradDialog, setOpenGradDialog] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserRow)));
        }, (err) => console.error('[UsersTab] users snapshot error:', error));
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'jobs'), (snap) => {
            setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job)));
        });
        return unsub;
    }, []);

    const jobTitle = (jobId?: string) => jobs.find((j) => j.id === jobId)?.title ?? '—';

    const openEdit = (user: UserRow) => {
        setEditUser(user);
        setEditForm({ ...user });
    };

    const handleSaveEdit = async () => {
        if (!editUser) return;
        try {
            const { id, jobId, supervisorIds, superviseeIds, ...otherFields } = editForm as UserRow;
            await updateDoc(doc(db, 'users', editUser.id), otherFields as any);
            if (editForm.jobId !== editUser.jobId && editForm.jobId) {
                await reassignJob(editUser, editForm.jobId);
            } else if (editForm.jobId !== editUser.jobId && !editForm.jobId) {
                await updateDoc(doc(db, 'users', editUser.id), { jobId: '', supervisorIds: [], superviseeIds: [] });
            }
            setEditUser(null);
        } catch (err) {
            console.error(err);
            setError('Failed to save changes');
        }
    };

    const reassignJob = async (targetUser: UserRow, newJobId: string) => {
        const newJob = jobs.find((j) => j.id === newJobId);
        if (!newJob) {
            console.error('[reassignJob] job not found');
            setError('Job not found, try again');
            return;
        }

        const oldHolder = users.find((u) => u.jobId === newJobId && u.id !== targetUser.id);
        const newSupervisor = newJob.parentJobId
            ? users.find((u) => u.jobId === newJob.parentJobId)
            : null;
        const newSupervisees = (newJob.childJobIds ?? [])
            .map((cid) => users.find((u) => u.jobId === cid))
            .filter((u): u is UserRow => !!u);

        const batch = writeBatch(db);

        // Update target user's job and relationships
        batch.update(doc(db, 'users', targetUser.id), {
            jobId: newJobId,
            supervisorIds: newSupervisor ? [newSupervisor.id] : [],
            superviseeIds: newSupervisees.map((u) => u.id),
        });

        // Strip old holder
        if (oldHolder) {
            batch.update(doc(db, 'users', oldHolder.id), {
                jobId: '',
                supervisorIds: [],
                superviseeIds: [],
            });
        }

        // Update new supervisor's superviseeIds
        if (newSupervisor) {
            const updated = [
                ...(newSupervisor.superviseeIds ?? []).filter(
                    (id) => id !== oldHolder?.id && id !== targetUser.id
                ),
                targetUser.id,
            ];
            batch.update(doc(db, 'users', newSupervisor.id), { superviseeIds: updated });
        }

        // Update each new supervisee's supervisorIds
        for (const supervisee of newSupervisees) {
            const updated = [
                ...(supervisee.supervisorIds ?? []).filter(
                    (id) => id !== oldHolder?.id && id !== targetUser.id
                ),
                targetUser.id,
            ];
            batch.update(doc(db, 'users', supervisee.id), { supervisorIds: updated });
        }

        // Remove target user from their old supervisor's superviseeIds
        for(const supId of targetUser.supervisorIds ?? []) {
            const sup = users.find((u) => u.id === supId);
            if (sup) {
                batch.update(doc(db, 'users', supId), {
                    superviseeIds: (sup.superviseeIds ?? []).filter((id) => id !== targetUser.id),
                });
            }
        }

        // Remove target user from their old supervisees' supervisorIds
        for(const subId of targetUser.superviseeIds ?? []) {
            const sub = users.find((u) => u.id === subId);
            if (sub) {
                batch.update(doc(db, 'users', subId), {
                    supervisorIds: (sub.supervisorIds ?? []).filter((id) => id !== targetUser.id),
                });
            }
        }

        await batch.commit();
    };

    const handleAddUser = async () => {
        if (!addForm.displayName.trim() || !addForm.email.trim()) return;
        try {
            await addDoc(collection(db, 'users'), {
                displayName: addForm.displayName.trim(),
                email: addForm.email.trim().toLowerCase(),
                classYear: addForm.classYear,
                rank: rankForYear(addForm.classYear),
                flight: addForm.flight,
                jobId: '',
                supervisorIds: [],
                superviseeIds: [],
                createdAt: serverTimestamp()
            });
            setAddForm({ displayName: '', email: '', classYear: '100', flight: 'Alpha' });
            setOpenAdd(false);
        } catch (err) {
            console.error(err);
            setError('Failed to add user');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, 'users', deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            console.error(err);
            setError('Failed to delte user');
        }
    };

    const handlePromote = async () => {
        setOpenPromoteConfirm(false);
        const batch = writeBatch(db);
        const graduating: UserRow[] = [];

        for (const user of users) {
            const newClassYear = nextClassYear(user.classYear ?? '');
            const newRank = nextRank(user.rank ?? '');

            if (newClassYear !== user.classYear || newRank !== user.rank) {
                batch.update(doc(db, 'users', user.id), { classYear: newClassYear, rank: newRank });
            }

            if (user.classYear === '400') {
                graduating.push(user);
            }
        }

        try {
            await batch.commit();
            if (graduating.length > 0) {
                setGraduatingCadets(graduating);
                setKeepMap(Object.fromEntries(graduating.map((u) => [u.id, true])));
                setOpenGradDialog(true);
            }
        } catch (err) {
            console.error(err);
            setError('Promotion failed');
        }
    };

    const handleGradFinalize = async () => {
        try {
            const batch = writeBatch(db);
            for (const cadet of graduatingCadets) {
                if (!keepMap[cadet.id]) {
                    batch.delete(doc(db, 'users', cadet.id));
                } else {
                    batch.update(doc(db, 'users', cadet.id), { classYear: '400' });
                }
            }
            await batch.commit();
            setOpenGradDialog(false);
            setGraduatingCadets([]);
        } catch (err) {
            console.error(err)
            setError('Failed to finalize graduation');
        }
    };

    const sorted = [...users].sort((a, b) => a.displayName.localeCompare(b.displayName));

    return (
        <Box>
            {error && <Alert severity='error' onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button variant='contained' startIcon={<PersonAddIcon />} onClick={() => setOpenAdd(true)}>
                    Add User
                </Button>
                <Button variant='outlined' color='warning' startIcon={<UpgradeIcon />} onClick={() => setOpenPromoteConfirm(true)}>
                    Promote All
                </Button>
            </Box>

            <List disablePadding sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {sorted.map((user) => (
                <ListItem
                    key={user.id}
                    divider
                    secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(user)}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(user)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                        </Tooltip>
                    </Box>
                    }
                >
                    <ListItemText
                    primary={user.displayName}
                    secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                        <Typography variant="caption">{user.email}</Typography>
                        {user.rank && <Chip label={user.rank} size="small" />}
                        {user.classYear && <Chip label={`Yr ${user.classYear}`} size="small" variant="outlined" />}
                        {user.flight && <Chip label={user.flight} size="small" color="primary" variant="outlined" />}
                        <Chip label={jobTitle(user.jobId)} size="small" color="secondary" variant="outlined" />
                        </Box>
                    }
                    />
                </ListItem>
                ))}
            </List>

            {/* edit dialog */}
            <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth='sm' fullWidth>
                <DialogTitle>Edit User</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Name"
                        fullWidth
                        value={editForm.displayName ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                    <TextField
                        label="Email"
                        fullWidth
                        value={editForm.email ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <Select
                        value={editForm.flight ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, flight: e.target.value }))}
                        displayEmpty
                    >
                        <MenuItem value=""><em>No flight</em></MenuItem>
                        {FLIGHTS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                    </Select>
                    <TextField
                        label="Rank"
                        fullWidth
                        value={editForm.rank ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, rank: e.target.value }))}
                    />
                    <Select
                        value={editForm.classYear ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, classYear: e.target.value }))}
                        displayEmpty
                    >
                        <MenuItem value=""><em>No class year</em></MenuItem>
                        {CLASS_YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                    <Autocomplete
                        options={jobs}
                        getOptionLabel={(j) => j.title}
                        value={jobs.find((j) => j.id === editForm.jobId) ?? null}
                        onChange={(_, val) => setEditForm((f) => ({ ...f, jobId: val?.id ?? '' }))}
                        renderInput={(params) => <TextField {...params} label="Job" />}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditUser(null)}>Cancel</Button>
                    <Button onClick={handleSaveEdit} variant='outlined'>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Add User Dialog */}
            <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth='xs' fullWidth>
                <DialogTitle>Add User</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Name"
                        fullWidth
                        value={addForm.displayName}
                        onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                    />
                    <TextField
                        label="Email"
                        fullWidth
                        value={addForm.email}
                        onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <Select
                        value={addForm.classYear}
                        onChange={(e) => setAddForm((f) => ({ ...f, classYear: e.target.value }))}
                    >
                        {CLASS_YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                    <TextField
                        label="Rank (auto)"
                        fullWidth
                        value={rankForYear(addForm.classYear)}
                        slotProps={{ input: { readOnly: true } }}
                    />
                    <Select
                        value={addForm.flight}
                        onChange={(e) => setAddForm((f) => ({ ...f, flight: e.target.value }))}
                    >
                        <MenuItem value="Alpha">Alpha</MenuItem>
                        <MenuItem value="Bravo">Bravo</MenuItem>
                    </Select>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
                    <Button onClick={handleAddUser} variant='contained'>Add</Button>
                </DialogActions>
            </Dialog>

            {/*Delete Confirm */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete "{deleteTarget?.displayName}"?</DialogTitle>
                <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button onClick={handleDelete} color='error' variant='contained'>Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Promote Confirm */}
            <Dialog open={openPromoteConfirm} onClose={() => setOpenPromoteConfirm(false)}>
                <DialogTitle>Promote All Cadets?</DialogTitle>
                <DialogContent>
                    <Typography>
                        This will advance every cadet's class year and rank. Cadets at year 400 will move to 'special' — you'll be asked what to do with them after.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPromoteConfirm(false)}>Cancle</Button>
                    <Button onClick={handlePromote} color='warning' variant='contained'>Promote</Button>
                </DialogActions>
            </Dialog>

            {/* Graduation Dialog */}
            <Dialog open={openGradDialog} onClose={() => {}} maxWidth='sm' fullWidth>
                <DialogTitle>Graduating Cadets (Year 400)</DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 2 }}>
                        The following cadets have been promoted to 'special'. Keep or remove each:
                    </Typography>
                    <List disablePadding>
                        {graduatingCadets.map((cadet) => (
                            <ListItem key={cadet.id} disablePadding>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={keepMap[cadet.id] ?? true}
                                            onChange={(e) => setKeepMap((m) => ({ ...m, [cadet.id]: e.target.checked }))}
                                        />   
                                    }
                                    label={`${cadet.displayName} — Keep`}
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleGradFinalize} variant='contained'>Confirm</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}