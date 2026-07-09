import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    IconButton,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { collection, collectionGroup, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import React, { useEffect, useRef, useState } from 'react';
import { db, storage } from '../../../firebase/firebase';
import { useUser } from '../../../hooks/useUser';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | 'Voluntarily Present';
const EVENT_TYPES = ['PT', 'LLAB', 'RMP'] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_COLOR: Record<EventType, string> = {
  PT: 'primary.main',
  LLAB: 'secondary.main',
  RMP: 'warning.main',
};

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  voluntarilyPresent: number;
  absencesAllowed: number;
  absencesUsed: number;
}

function calcSummary(statuses: (AttendanceStatus | undefined)[]): AttendanceSummary {
    const logged = statuses.filter((s) => s !== undefined) as AttendanceStatus[];
    const total = statuses.length;
    const present = logged.filter((s) => s === 'Present').length;
    const absent = logged.filter((s) => s === 'Absent').length;
    const late = logged.filter((s) => s === 'Late').length;
    const excused = logged.filter((s) => s === 'Excused').length;
    const voluntarilyPresent = logged.filter((s) => s === 'Voluntarily Present').length;
    const absencesAllowed = Math.floor(total * 0.2 * 2) / 2;
    const absencesUsed = absent + late * 0.5;
    return { total, present, absent, late, excused, voluntarilyPresent, absencesAllowed, absencesUsed};
}

function absencesRemaining(summary: AttendanceSummary): string {
    if (summary.total === 0) return '-';
    const rem = summary.absencesAllowed - summary.absencesUsed;
    return rem % 1 === 0 ? String(rem) : rem.toFixed(1);
}

export default function Profile() {
    const { userData, userJob, loading } = useUser();
    const [bio, setBio] = useState('');
    const [editingBio, setEditingBio] = useState(false);
    const [bioValue, setBioValue] = useState('');
    const [bioSaving, setBioSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [attendanceSummaries, setAttendanceSummaries] = useState<Record<EventType, AttendanceSummary | null>>({
        PT: null, LLAB: null, RMP: null
    });
    const [attLoading, setAttLoading] = useState(false);

    // Sync bio and photo from Firestore userData
    useEffect(() => {
        const firestoreBio = (userData as any)?.bio ?? '';
        setBio(firestoreBio);
        setBioValue(firestoreBio);
        setPhotoURL((userData as any)?.photoURL ?? null);
    }, [userData]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.uid) return;
        
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.type)) {
            setError('Please select a JPEG, PNG, or WebP image.');
            return;
        }

        setPhotoUploading(true);
        setUploadProgress(0);
        const storageRef = ref(storage, `profile-photos/${userData.uid}`);
        const task = uploadBytesResumable(storageRef, file);

        task.on(
            'state_changed',
            (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            (err) => {
                console.error(err);
                setError('Photo upload failed');
                setPhotoUploading(false);
            },
            async () => {
                try {
                    const url = await getDownloadURL(task.snapshot.ref);
                    await updateDoc(doc(db, 'users', userData.uid), { photoURL: url });
                    setPhotoURL(url);
                } catch (err) {
                    console.error(err);
                    setError('Failed to save photo URL');
                } finally {
                    setPhotoUploading(false);
                    // reset input so the same file can be re-selected
                    if (photoInputRef.current) photoInputRef.current.value = '';
                }
            }
        );
    };

    //Load attendance summaries
    useEffect(() => {
        if (!userData?.uid) return;
        setAttLoading(true);

        const load = async () => {
            try {
                const uid = userData.uid;

                const [eventsSnap, attSnap] = await Promise.all([
                    getDocs(query(collection(db, 'events'), where('mandatory', '==', true))),
                    getDocs(query(collectionGroup(db, 'attendance'), where('userId', '==', uid))),
                ]);

                const eventTitles: Record<string, string> = {};
                eventsSnap.docs.forEach((d) => {
                    eventTitles[d.id] = (d.data().title as string).trim().toUpperCase();
                });

                const totalByType: Record<EventType, number> = { PT: 0, LLAB: 0, RMP: 0 };
                Object.values(eventTitles).forEach((title) => {
                    if (title == 'PT' || title == 'LLAB' || title == 'RMP') totalByType[title as EventType]++;
                });

                const loggedByType: Record<EventType, AttendanceStatus[]> = { PT: [], LLAB: [], RMP: [] };

                attSnap.docs.forEach((d) => {
                    const eventId = d.ref.parent.parent!.id;
                    const type = eventTitles[eventId] as EventType | undefined;
                    if (type && type === 'PT' || type === 'LLAB' || type === 'RMP') {
                        loggedByType[type].push(d.data().status as AttendanceStatus);
                    }
                });

                const summaries: Record<EventType, AttendanceSummary | null> = {PT: null, LLAB: null, RMP: null };
                for (const type of EVENT_TYPES) {
                    const logged = loggedByType[type];
                    const unlogged = Math.max(0, totalByType[type] - logged.length);
                    summaries[type] = calcSummary([ ...logged, ...Array<undefined>(unlogged).fill(undefined)]);
                }

                setAttendanceSummaries(summaries);
            } catch (err) {
                console.error(err);
                setError('Failed to load attendance');
            } finally {
                setAttLoading(false);
            }
        };

        load();
    }, [userData?.uid]);

    const handleSaveBio = async () => {
        if (!userData?.uid) return;
        setBioSaving(true);
        try {
            await updateDoc(doc(db, 'users', userData.uid), { bio: bioValue });
            setBio(bioValue);
            setEditingBio(false);
        } catch (err) {
            console.error(err);
            setError('Failed to save bio');
        } finally {
            setBioSaving(false);
        }
    };

    const handleCancleBio = () => {
        setBioValue(bio);
        setEditingBio(false);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    const rem = (type: EventType) => {
        const s = attendanceSummaries[type];
        return s ? absencesRemaining(s) : '-';
    };

    const remColor = (type: EventType) => {
        const s = attendanceSummaries[type];
        if (!s || s.total === 0) return 'textSecondary';
        const r = s.absencesAllowed - s.absencesUsed;
        if (r <= 0) return 'error.main';
        if (r <= 1) return 'warning.main';
        return 'success.main';
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, maxWidth: 680, mx: 'auto' }}>
            {error && <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>}

            {/* Info Card */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Hidden file input */}
                        <input
                            ref={photoInputRef}
                            type='file'
                            accept='image/jpeg,image/png,image/webp,image/gif'
                            style={{ display: 'none' }}
                            onChange={handlePhotoChange}
                        />

                        {/* Clickable avatar with camera overlay */}
                        <Tooltip title='Change Photo'>
                            <Box
                                onClick={() => !photoUploading && photoInputRef.current?.click()}
                                sx={{
                                    position: 'relative',
                                    width: 96,
                                    height: 96,
                                    flexShrink: 0,
                                    cursor: photoUploading ? 'default' : 'pointer',
                                    '&:hover .avatar-overlay': { opacity: 1 },
                                }}
                            >
                                <Avatar
                                    src={photoURL ?? undefined}
                                    sx={{ width: 96, height: 96, fontSize: 32, bgcolor: 'primary.main' }}
                                >
                                    {<PersonOutlined />}
                                </Avatar>

                                {/* Hover overlay */}
                                <Box
                                    className='avatar-overlay'
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(0,0,0,0.45)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: photoUploading ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                    }}
                                >
                                    {photoUploading ? (
                                        <CircularProgress size={28} sx={{ color: '#fff' }} variant='determinate' value={uploadProgress} />
                                    ) : (
                                        <CameraAltIcon sx={{ color: '#fff', fontSize: 28 }} />
                                    )}
                                </Box>
                            </Box>
                        </Tooltip>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant='h5' sx={{ fontWeight: 700 }}>
                                {userData?.displayName ?? '-'}
                            </Typography>

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                                <InfoItem label='Rank' value={userData?.rank} />
                                <InfoItem label='Class Year' value={userData?.classYear} />
                                <InfoItem label='Flight' value={userData?.flight} />
                                <InfoItem label='Job' value={userJob?.title} />
                                <InfoItem label='Email' value={userData?.email} />
                                <InfoItem label='Phone' value={userData?.phone} />
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Bio Card */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant='h6'>Bio</Typography>
                        {!editingBio && (
                            <Tooltip title="Edit bio">
                                <IconButton size='small' onClick={() => setEditingBio(true)}>
                                    <EditIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>

                    {editingBio ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                                multiline
                                minRows={3}
                                fullWidth
                                value={bioValue}
                                onChange={(e) => setBioValue(e.target.value)}
                                placeholder='Write a short bio...'
                                autoFocus
                            />
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                <Button size='small' startIcon={<CloseIcon />} onClick={handleCancleBio}>Cancel</Button>
                                <Button
                                    size='small'
                                    variant='contained'
                                    startIcon={<CheckIcon />}
                                    onClick={handleSaveBio}
                                    disabled={bioSaving}
                                >{bioSaving ? 'Saving...' : 'Save'}</Button>
                            </Box>
                        </Box>
                    ) : (
                        <Typography variant='body2' color={bio ? 'textPrimary' : 'textDisabled'} sx={{ whiteSpace: 'pre-wrap' }}>
                            {bio || 'No bio yet. Click the edit button to add one.'}
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Attendance Cards */}
            <Typography variant='h6' sx={{ mt: 1 }}>Attendance</Typography>

            {attLoading ? (
                <CircularProgress size={24} />
            ) : (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {EVENT_TYPES.map((type) => {
                        const s = attendanceSummaries[type];
                        return (
                            <Card key={type} sx={{ flex: '1 1 180px', minWidth: 160 }}>
                                <CardContent>
                                    <Typography
                                        variant='subtitle1'
                                        sx={{ fontWeight: 700, color: TYPE_COLOR[type], mb: 1 }}
                                    >{type}</Typography>

                                    <Typography variant='h4' sx={{ fontWeight: 700, color: remColor(type) }}>{rem(type)}</Typography>
                                    <Typography variant='caption' color='textSecondary'>absences remaining</Typography>

                                    {s && s.total > 0 && (
                                        <>
                                            <Divider sx={{ my: 1 }} />
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25}}>
                                                <StatRow label='Present' value={s.present} />
                                                <StatRow label='Late' value={s.late} />
                                                <StatRow label='Absent' value={s.absent} />
                                                <StatRow label='Excused' value={s.excused} />
                                                {type === 'RMP' && <StatRow label='Vol. Present' value={s.voluntarilyPresent} />}
                                            </Box>
                                        </>
                                    )}

                                    {(!s || s.total === 0) && (
                                        <Typography variant='caption' color='textDisabled' sx={{ display: 'block', mt: 0.5 }}>No events logged</Typography>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
    return (
        <Box>
            <Typography variant='caption' color='textSecondary' sx={{ display: 'block' }}>{label}</Typography>
            <Typography variant='body2' sx={{ fontWeight: 500 }}>{value ?? '-'}</Typography>
        </Box>
    );
}

function StatRow({ label, value }: { label: string; value: number; }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant='caption' color='textSecondary'>{label}</Typography>
            <Typography variant='caption'>{value}</Typography>
        </Box>
    );
}