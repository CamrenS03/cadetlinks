import * as React from 'react';
import BottomNavigation from './components/BottomNavigation';
import {
    Box,
    CssBaseline,
} from '@mui/material'
import AppTheme from '../shared-theme/AppTheme';
import AppHeader from '../shared-theme/Header';
import Home from './components/Home';
import Events from './components/Events';
import Resources from './components/Resources';
import Profile from './components/Profile';
import { AppContainer } from '../shared-theme/AppContainer';

export default function Dashboard(props: { disableCustomTheme?: boolean }) {
    const [value, setValue] = React.useState('home');

    const renderContent = () => {
        switch(value) {
            case 'home':
                return <Home />;
            case 'events':
                return <Events />;
            case 'actions':
                return <Resources />;
            case 'profile':
                return <Profile />;
            default:
                return <Home />;
        }
    }

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <AppContainer direction="column" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <AppHeader />
                <Box sx={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
                    {renderContent()}
                </Box>
                <BottomNavigation value={value} onChange={(e, newValue) => setValue(newValue)} />
            </AppContainer>
        </AppTheme>
    )
}