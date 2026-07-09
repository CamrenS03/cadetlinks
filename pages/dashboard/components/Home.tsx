import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import { Box, Card, CardActions, CardContent, Chip, IconButton, Paper, Typography } from "@mui/material";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    where
} from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useAppData } from "../../../firebase/AppDataContext";
import { useAuth } from "../../../firebase/AuthContext";
import { db } from "../../../firebase/firebase";
import AddAnnouncementModal from "./modals/AddAnnouncementModal";
import DeleteAnnouncementModal from "./modals/DeleteAnnouncementModal";

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
    location: string;
    date: Date;
    mandatory: boolean;
    userRsvp: boolean;
}

const IMPORTANCE_COLOR: Record<string, 'error' | 'warning' | 'default'> = {
    high: 'error',
    medium: 'warning',
    low: 'default'
};

export default function Home() {
    const { currentUser } = useAuth();
    const { users, jobs } = useAppData();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const userId = currentUser?.uid ?? '';

    const cachedUser = users.find((u) => u.uid === userId);
    const cachedJob = cachedUser?.jobId ? jobs.find((j) => j.id === cachedUser.jobId) : undefined;
    const canManageAnnouncements = cachedJob?.permissions?.some((p) =>
        ['manage_announcements', 'admin'].includes(p)
    ) ?? false;

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
        if(!userId) {
            return;
        }

        try {
            const now = new Date();
            const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

            const q = query(
                collection(db, 'events'),
                where('startDate', '>=', now),
                where('startDate', '<=', threeDaysLater),
                orderBy('startDate', 'asc')
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
                            location: eventData.location,
                            date: eventData.startDate.toDate(),
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
    }, [userId]);

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
                    {canManageAnnouncements && (
                        <IconButton 
                            aria-label='add' 
                            onClick={() => setOpenAddModal(true)} 
                            color='secondary'
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
                            <Card key={announcement.id} sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', flexShrink: 0 }}>
                                <CardContent>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignContent: 'start',
                                        gap: 1
                                    }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant='subtitle1' sx={{ fontSize:{ xs: 14, sm: 18 }, fontWeight: 'bold' }}>{announcement.title}</Typography>
                                                {announcement.importance !== 'low' && (
                                                    <Chip
                                                        label={announcement.importance.charAt(0).toUpperCase() + announcement.importance.slice(1)}
                                                        color={IMPORTANCE_COLOR[announcement.importance]}
                                                        size='small'
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant='body2' color='textSecondary' sx={{ mt: 1 }}>{announcement.details}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                                {canManageAnnouncements && (
                                    <CardActions>
                                        <IconButton 
                                            aria-label='delete'
                                            onClick={() => {
                                                setSelectedAnnouncement(announcement);
                                                setOpenDeleteModal(true); 
                                            }}
                                            color='error'
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
                            <Card key={event.id} sx={{ flexShrink: 0 }}>
                                <CardContent>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'start',
                                        gap: 1
                                    }}>
                                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                            <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>{event.title}</Typography>
                                            <Typography variant='body2' color='textSecondary'>@ {event.location}</Typography>
                                            <Typography variant='body2' color='textSecondary'>
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

            <AddAnnouncementModal open={openAddModal} onClose={() => setOpenAddModal(false)} />
            <DeleteAnnouncementModal 
                open={openDeleteModal} 
                onClose={() => setOpenDeleteModal(false)} 
                id={selectedAnnouncement?.id || ''} 
                onConfirm={handleDeleteAnnouncement}
                title={selectedAnnouncement?.title || ''}
                expirationDate={selectedAnnouncement?.expirationDate || null}
            />
        </Box>
    )
}

export const page = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    p: 2,
}