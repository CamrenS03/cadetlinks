import * as React from 'react';
import {
    Box,
    BottomNavigation,
    BottomNavigationAction,
} from '@mui/material'
import Home from '@mui/icons-material/Home'
import Calendar from '@mui/icons-material/CalendarMonth'
import Menu from '@mui/icons-material/Menu'
import Person from '@mui/icons-material/Person'

export default function bottomNavigation({value, onChange}: { value: string, onChange: (e: React.SyntheticEvent, newValue: string) => void }) {
    return (
        <BottomNavigation value={value} onChange={onChange} sx={{ width: '100%', maxWidth: 500 }}>
            <BottomNavigationAction label="Home" value='home' icon={<Home />} />
            <BottomNavigationAction label="Events" value='events' icon={<Calendar />} />
            <BottomNavigationAction label="Profile" value='profile' icon={<Person />} />
            <BottomNavigationAction label="" value='actions' icon={<Menu />} />
        </BottomNavigation>
    )
}