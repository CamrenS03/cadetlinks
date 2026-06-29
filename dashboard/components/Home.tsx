import { Box, Card, CardActions, CardContent, Chip, IconButton, Paper, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete"
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from "../../firebase/firebase";
import AddAnnouncementModal from "./modals/AddAnnouncementModal";

interface Announcement {
    id: string;
    title: string;
    details: string;
    importance: 'high' | 'medium' | 'low';
    expirationDate: Date;
    createdAt: Date;
    createdBy: string;
}

interface Event {
    id: string;
    title: string;
    date: Date;
    mandatory: boolean;
    userRsvp: boolean;
}

export default function Home() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [openModal, setOpenModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');

    useEffect(() => { 
        const userStr = localStorage.getItem('user');
        if(userStr) {
            const user = JSON.parse(userStr);
            setUserId(user.uid);
            fetchUserRole(user.uid);
        }
    }, []);

    const fetchUserRole = async (uid: string) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if(userDoc.exists()) {
                const userData = userDoc.data();
                if(userData.jobId) {
                    const jobDoc = await getDoc(doc(db, 'jobs', userData.jobId));
                    if(jobDoc.exists()) {
                        const jobData = jobDoc.data();
                        setIsAdmin(jobData.permissions?.includes('manage_announcements') || false);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user role:', error)
        }
    }

    useEffect(() => {
        try {
            const q =query(
                collection(db, 'announcements'),
                where('expirationDate', '>', new Date()),
                orderBy('expirationDate', 'asc')
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const announcementList: Announcement[] = [];

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    announcementList.push({
                        id: doc.id,
                        title: data.title,
                        details: data.details,
                        importance: data.importance || 'low',
                        expirationDate: data.expirationDate.toDate(),
                        createdAt: data.createdAt.toDate(),
                        createdBy: data.createdBy
                    });
                });

                const importanceOrder = { high: 0, medium: 1, low: 2 };
                announcementList.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);
                
                setAnnouncements(announcementList);
            });
            
            return () => unsubscribe();
        } catch (error) {
            console.error('Error fetching announcements:', error);
        }
    }, []);

    useEffect(() => {
        if(!userId) return;

        try {
            const now = Date.now();
            const threeDaysLater =  now + 3 * 24 * 60 * 60 * 1000;

            const q = query(
                collection(db, 'events'),
                where('date', '>=', now),
                where('date', '<=', threeDaysLater),
                orderBy('date', 'asc')
            );

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const eventList: Event[] = [];

                for (const eventDoc of snapshot.docs) {
                    const eventData = eventDoc.data();

                    const rsvpRef = collection(db, 'events', eventDoc.id, 'rsvps');
                    const rsvpQuery = query(rsvpRef, where('userId', '==', userId));
                    const rsvpSnapshot = await getDocs(rsvpQuery);

                    if(eventData.mandatory || !rsvpSnapshot.empty) {
                        eventList.push({
                            id: eventDoc.id,
                            title: eventData.title,
                            date: eventData.date.toDate(),
                            mandatory: eventData.mandatory || false,
                            userRsvp: !rsvpSnapshot.empty,
                        });
                    }
                }

                eventList.sort((a, b) => a.date.getTime() - b.date.getTime());
                setUpcomingEvents(eventList);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    }, []);

    const handleDeleteAnnouncement = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'announcements', id));
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%', p: 2 }}>
            <Paper sx={{
                ...page,
                flex: '0 0 55%'
            }}>
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2
                }}>
                    <Typography variant="h6">Announcements</Typography>
                    {isAdmin && (
                        <IconButton 
                            aria-label='add' 
                            onClick={() => setOpenModal(true)} 
                            sx={{ backgroundColor: '#1a68fa !important', color: 'white', '&:hover': { backgroundColor: '#1554c9 !important' } }}
                        >
                            <Add />
                        </IconButton>
                    )}
                </Box>
                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                }}>
                    {announcements.length === 0 ? (
                        <Typography color='textSecondary' sx={{ textAlign: 'center', mt: 3 }}>No Announcements</Typography>
                    ) : (
                        announcements.map((announcement) => (
                            <Card key={announcement.id} sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
                                <CardContent>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignContent: 'start',
                                        gap: 1
                                    }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant='subtitle1' sx={{ fontSize:{ xs: 14, sm: 18 }, fontWeight: 'bold' }}>{announcement.title}</Typography>
                                            <Typography variant='body2' color='textSecondary' sx={{ mt: 1 }}>{announcement.details}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                                {isAdmin && (
                                    <CardActions>
                                        <IconButton 
                                            aria-label='delete'
                                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                                            sx={{ backgroundColor: '#fa1a1a !important', color: 'white', '&:hover': { backgroundColor: '#c91515 !important' } }}
                                        >
                                            <Delete />
                                        </IconButton> 
                                    </CardActions>
                                )}
                            </Card>
                        ))
                    )}
                </Box>
            </Paper>

            <Paper sx={{
                ...page,
                flex: '0 0 45%'
            }}>
                <Typography variant='h6' sx={{ mb: 2 }}>Upcoming Events</Typography>

                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                }}>
                    {upcomingEvents.length === 0 ? (
                        <Typography color='textSecondary' sx={{ textAlign: 'center', mt: 3 }}>No upcoming events</Typography>
                    ) : (
                        upcomingEvents.map((event) => (
                            <Card key={event.id}>
                                <CardContent>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'start',
                                        gap: 1
                                    }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>{event.title}</Typography>
                                            <Typography variant='body2' color='textSecondary' sx={{ mt: 1 }}>
                                                {event.date.toLocaleDateString()} {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                        {event.mandatory && (
                                            <Chip label='Mandatory' color='error' size='small' variant='outlined' />
                                        )}
                                        {event.userRsvp && (
                                            <Chip label="RSVP'd" color='success' size='small' variant='outlined' />
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </Box>
            </Paper>

            <AddAnnouncementModal open={openModal} onClose={() => setOpenModal(false)} />
        </Box>
    )
}

export const page = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    p: 2,
    backgroundColor: '#161b31'
}