import { Person2Outlined } from '@mui/icons-material';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Dialog,
    Divider,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { CachedJob, CachedUser } from '../../firebase/AppDataContext';

interface Props {
    user: CachedUser;
    job?: CachedJob;
}

export default function PublicProfile({ user, job }: Props) {
    const [photoOpen, setPhotoOpen] = useState(false);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {user.photoURL && (
                <Dialog open={photoOpen} onClose={() => setPhotoOpen(false)} maxWidth='sm' fullWidth>
                    <Box 
                        component='img' 
                        src={user.photoURL} 
                        alt={user.displayName} 
                        onClick={() => setPhotoOpen(false)} 
                        sx={{ width: '100%', height: 'auto', display: 'block', cursor: 'zoom-out' }} 
                    />
                </Dialog>
            )}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <Avatar 
                            src={user.photoURL}
                            onClick={() => user.photoURL && setPhotoOpen(true)}
                            sx={{
                                width: 96, height: 96, fontSize: 32, bgcolor: 'primary.main', flexShrink: 0,
                                cursor: user.photoURL ? 'zoom-in' : 'default',
                            }}
                        >{!user.photoURL && <Person2Outlined />}</Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant='h5' sx={{ fontWeight: 700 }}>{user.displayName}</Typography>

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                                <InfoItem label='Rank' value={user?.rank} />
                                <InfoItem label='Class Year' value={user?.classYear} />
                                <InfoItem label='Flight' value={user?.flight} />
                                <InfoItem label='Job' value={job?.title} />
                                <InfoItem label='Email' value={user?.email} />
                                <InfoItem label='Phone' value={user?.phone} />
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant='h6' sx={{ mb: 1 }}>Bio</Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant='body2' color={user.bio ? 'textPrimary' : 'textDisabled'} sx={{ whiteSpace: 'pre-wrap' }}>
                        {user.bio || 'This cadet has not added a bio yet.'}
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    )
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
    return (
        <Box>
            <Typography variant='caption' color='textSecondary' sx={{ display: 'block' }}>{label}</Typography>
            <Typography variant='body2' sx={{ fontWeight: 500 }}>{value ?? '-'}</Typography>
        </Box>
    );
}