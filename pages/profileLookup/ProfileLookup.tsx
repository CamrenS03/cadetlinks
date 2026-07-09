import { Person2Outlined } from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActionArea,
  CardContent,
  CssBaseline,
  InputAdornment,
  List,
  ListItem,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { CachedJob, CachedUser, useAppData } from '../../firebase/AppDataContext';
import { FLIGHTS } from '../../lib/constants';
import { AppContainer } from '../../shared-theme/AppContainer';
import AppTheme from '../../shared-theme/AppTheme';
import AppHeader from '../../shared-theme/Header';
import PublicProfile from './PublicProfile';

function userMatchesSearch(user: CachedUser, job: CachedJob | undefined, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  if (user.displayName.toLowerCase().includes(q)) return true;
  if (job?.title.toLowerCase().includes(q)) return true;
  return false;
}

export default function ProfileLookup(props: { disabledCustomTheme?: boolean }) {
  const { users, jobs } = useAppData();
  const [search, setSearch] = useState('');
  const [flightFilter, setFlightFilter] = useState('All');
  const [selected, setSelected] = useState<CachedUser | null>(null);

  const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const filtered = users.filter((u) => {
    if (flightFilter !== 'All' && u.flight !== flightFilter) return false;
    return userMatchesSearch(u, u.jobId ? jobMap[u.jobId] : undefined, search);
  });

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <AppContainer
        direction="column"
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <AppHeader />
        {selected ? (
          <Box sx={{ flex: 1, width: '100%', maxWidth: 680, mx: 'auto', p: 2 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setSelected(null)} sx={{ mb: 2 }}>
              Back to search
            </Button>
            <PublicProfile user={selected} job={jobMap[selected.jobId ?? ''] ?? undefined} />
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              width: '100%',
              maxWidth: 680,
              mx: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Profile Lookup
            </Typography>

            <TextField
              placeholder="Search by name or job title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" color="textSecondary">
                Flight:
              </Typography>
              <ButtonGroup size="small">
                {['All', ...FLIGHTS].map((f) => (
                  <Button
                    key={f}
                    variant={flightFilter === f ? 'contained' : 'outlined'}
                    onClick={() => setFlightFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>

            {filtered.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                No cadets match your search.
              </Typography>
            ) : (
              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {filtered.map((user) => {
                  const job = user.jobId ? jobMap[user.jobId] : undefined;
                  return (
                    <ListItem key={user.uid} disablePadding>
                      <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardActionArea
                          onClick={() => setSelected(user)}
                          sx={{ justifyContent: 'left' }}
                        >
                          <CardContent
                            sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}
                          >
                            <Avatar
                              src={user.photoURL}
                              sx={{ width: 44, height: 44, bgcolor: 'primary.main', fontSize: 16 }}
                            >
                              {!user.photoURL && <Person2Outlined />}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>
                                {user.displayName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" noWrap>
                                {[user.classYear, user.flight, job?.title]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Typography>
                            </Box>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        )}
      </AppContainer>
    </AppTheme>
  );
}
