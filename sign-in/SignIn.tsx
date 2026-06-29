import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { auth, db } from '../firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Box,
  Button,
  Checkbox,
  CssBaseline,
  FormControlLabel,
  FormLabel,
  FormControl,
  Link,
  TextField,
  Typography,
  Stack,
  Card as MuiCard,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ForgotPassword from './components/ForgotPassword';
import AppTheme from '../shared-theme/AppTheme';
import ColorModeIconDropdown from '../shared-theme/ColorModeIconDropdown';
import { AppContainer } from '../shared-theme/AppContainer';

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '450px',
  },
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

export default function SignIn(props: { disableCustomTheme?: boolean }) {
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [authError, setAuthError ] = React.useState('');
  const navigate = useNavigate();
  const [rememberMe, setRememberMe] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');

    if(!validateInputs()) return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');

    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      localStorage.setItem('authToken', user.uid);
      localStorage.setItem('user', JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }));
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastSignIn: new Date()
      }, { merge: true });

      navigate('/dashboard');
    } catch (error: any) {
      setAuthError(error.message || 'Sign in failed. Please try again.');
    }
  };

  const validateInputs = () => {
    const email = document.getElementById('email') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;

    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage('Please enter a valid email address.');
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage('Password must be at least 6 characters long.');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    return isValid;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <AppContainer direction="column" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <ColorModeIconDropdown sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
        <Card variant="outlined" sx={{ minWidth: '25vw' }}>
          <Box>
            <Box sx={{ display: 'flex' }}>
              <Typography variant="h4" sx={{ color:"orange", fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}>Cadet</Typography>
              <Typography variant="h4" sx={{ fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}>Links</Typography>
            </Box>
            <Typography variant="caption">AFROTC Cadet Portal</Typography>
          </Box>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                error={emailError}
                helperText={emailErrorMessage}
                id="email"
                type="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={emailError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                error={passwordError}
                helperText={passwordErrorMessage}
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                autoComplete="current-password"
                required
                fullWidth
                variant="outlined"
                color={passwordError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControlLabel
              control={
              <Checkbox 
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                color="primary" 
              />}
              label="Remember me"
            />
            <Button type="submit" fullWidth variant="contained">
              Sign in
            </Button>
            {authError && (
              <Typography color='error' sx={{ mt: 1 }}>{authError}</Typography>
            )}
            <Link
              component="button"
              type="button"
              onClick={handleClickOpen}
              variant="body2"
              sx={{ alignSelf: 'center' }}
            >
              Forgot your password?
            </Link>
            <ForgotPassword open={open} handleClose={handleClose} />
          </Box>
        </Card>
      </AppContainer>
    </AppTheme>
  );
}
