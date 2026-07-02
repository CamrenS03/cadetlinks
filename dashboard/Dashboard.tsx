import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from './components/BottomNavigation';
import {
    Box,
    CssBaseline,
    IconButton,
    Stack,
    Typography,
} from '@mui/material'
import { styled } from '@mui/material/styles';
import AppTheme from '../shared-theme/AppTheme';
import ColorModeIconDropdown from '../shared-theme/ColorModeIconDropdown';
import Home from './components/Home';
import Events from './components/Events';
import Actions from './components/Actions';
import Profile from './components/Profile';
import Logout from '@mui/icons-material/Logout';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { AppContainer } from '../shared-theme/AppContainer';

export default function Dashboard(props: { disableCustomTheme?: boolean }) {
    const [value, setValue] = React.useState('home');
    const navigate = useNavigate();

    const renderContent = () => {
        switch(value) {
            case 'home':
                return <Home />;
            case 'events':
                return <Events />;
            case 'actions':
                return <Actions />;
            case 'profile':
                return <Profile />;
            default:
                return <Home />;
        }
    }

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <AppContainer direction="column" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', marginTop: { sm: -2.5 } }}>
                    <Typography variant="h6" sx={{ color:"orange", fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>Cadet</Typography>
                    <Typography variant="h6" sx={{ fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>Links</Typography>
                </Box>
                <IconButton aria-label='logout' size='small' onClick={handleLogout} sx={{ position: 'fixed', top: '1rem', right: '1rem' }}>{<Logout />}</IconButton>
                <ColorModeIconDropdown sx={{ position: 'fixed', top: '1rem', right: '3.5rem' }} />
                <Box sx={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
                    {renderContent()}
                </Box>
                <BottomNavigation value={value} onChange={(e, newValue) => setValue(newValue)} />
            </AppContainer>
        </AppTheme>
    )
}