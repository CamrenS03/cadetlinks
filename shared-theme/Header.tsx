import { Box, IconButton, Typography } from '@mui/material';
import Logout from '@mui/icons-material/Logout';
import Home from '@mui/icons-material/Home';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import ColorModeIconDropdown from './ColorModeIconDropdown';

export default function AppHeader() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', marginTop: { sm: -2.5 } }}>
        <IconButton
            aria-label="dashboard"
            size="small"
            onClick={() => navigate('/dashboard')}
            sx={{ position: 'fixed', top:'1rem', left: '1rem' }}
        >
            <Home />
        </IconButton>
        <Typography variant="h6" sx={{ color: 'orange', fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>
          Cadet
        </Typography>
        <Typography variant="h6" sx={{ fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>
          Links
        </Typography>
      </Box>
      <ColorModeIconDropdown sx={{ position: 'fixed', top: '1rem', right: '3.5rem' }} />
      <IconButton
        aria-label="logout"
        size="small"
        onClick={handleLogout}
        sx={{ position: 'fixed', top: '1rem', right: '1rem' }}
      >
        <Logout />
      </IconButton>
    </>
  );
}
