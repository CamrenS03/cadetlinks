import React, { useState } from 'react';
import { Box, CssBaseline, Tab, Tabs } from '@mui/material';
import AppTheme from '../../shared-theme/AppTheme';
import AppHeader from '../../shared-theme/Header';
import { AppContainer } from '../../shared-theme/AppContainer';
import Logger from './components/Logger'
import AttendanceSheet from './components/AttendanceSheet'

const TABS = [
    { label: 'Logger', component: <Logger /> },
    { label: 'Attendance Sheet', component: <AttendanceSheet /> }
];

export default function Attendance(props: {disableCustomTheme?: boolean }) {
    const [tab, setTab] = useState(0);

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <AppContainer direction='column' sx={{ justifyContent: 'flex-start', alignItems: 'center' }}>
                <AppHeader />

                <Box sx={{ width: '100%', maxWidth: 1200, mt: 2, px: 2 }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                        {TABS.map((t, i) => (
                            <Tab key={t.label} label={t.label} value={i} />
                        ))}
                    </Tabs>

                    {TABS[tab].component}
                </Box>
            </AppContainer>
        </AppTheme>
    );
}