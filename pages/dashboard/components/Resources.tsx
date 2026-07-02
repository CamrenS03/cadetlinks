import React from 'react';
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Typography,
    Grid,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';

interface ResourceCard {
    label: string,
    description: string,
    icon: React.ReactNode,
    page: string,
    visible: boolean,
    locked?: boolean,
}

export default function Resources() {
    const navigate = useNavigate();
    const { userJob } = useUser();

    const hasAttendanceAccess = userJob?.permissions?.some((p) =>
        ['manage_attendance', 'admin']. includes(p)) ?? false;
    const isAdmin = userJob?.permissions?.includes('admin') ?? false;

    const resources: ResourceCard[] = [
        {
            label: 'Documents',
            description: 'Access shared files',
            icon: <FolderIcon sx={{ fontSize: 40 }} />,
            page: '/documents',
            visible: true,
        },
        {
            label: 'Profile Lookup',
            description: 'Search and view cadet profiles',
            icon: <PersonSearchIcon sx={{ fontSize: 40 }} />,
            page: '/profileLookup',
            visible: true,
        },
        {
            label: 'Attendance',
            description: 'Manage attendance',
            icon: <FactCheckIcon sx={{ fontSize: 40 }} />,
            page: '/attendance',
            visible: true,
            locked: !hasAttendanceAccess,
        },
        {
            label: 'Admin',
            description: 'User and job management',
            icon: <AdminPanelSettingsIcon sx={{ fontSize: 40 }} />,
            page: '/admin',
            visible: true,
            locked: !isAdmin,
        },
    ];

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant='h5' sx={{ fontWeight: 600, mb: 3 }}>Resources</Typography>
            <Grid container spacing={2}>
                {resources.map((resource) => (
                    <Grid item='true' xs={6} key={resource.page}>
                        <Card variant='outlined' sx={{ height: '100%', opacity: resource.locked ? 0.5: 1, position: 'relative' }}>
                            <CardActionArea
                                disabled={resource.locked}
                                onClick={() => navigate(resource.page)}
                                sx={{ height: '100%', p: 1 }}
                            >
                                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1 }}>
                                    {resource.icon}
                                    <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>{resource.label}</Typography>
                                    <Typography variant='body2' color='textSecondary'>{resource.description}</Typography>
                                    {resource.locked && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                            <LockIcon sx={{ fontSize: 14 }} color='disabled' />
                                            <Typography variant='caption' color='textSecondary'>No Access</Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}