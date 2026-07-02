import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    FormLabel,
    Button,
    Box,
} from '@mui/material';
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../../firebase/firebase';
import { useAuth } from '../../../firebase/AuthContext';

interface AddAnnouncementModalProps {
    open: boolean;
    onClose: () => void;
}

export default function AddAnnouncementModal({open, onClose}: AddAnnouncementModalProps) {
    const { currentUser } = useAuth();
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const [importance, setImportance] = useState<'high' | 'medium' | 'low'>('low');
    const [expirationDate, setExpirationDate] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title || !details || !expirationDate) {
            alert('Please fill in all fields');
            return;
        }

        setLoading(true);
        try{
            await addDoc(collection(db, 'announcements'), {
                title,
                details,
                importance,
                expirationDate: Timestamp.fromDate(new Date(expirationDate)),
                createdAt: Timestamp.now(),
                createdBy: currentUser?.uid || 'unknown'
            });

            setTitle('');
            setDetails('');
            setImportance('low');
            setExpirationDate('');
            onClose();
        } catch (error) {
            console.error('Error adding announcement:', error);
            alert('Failed to add announcement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>Add New Announcement</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField label='Title' value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
                    <TextField label='Details' value={details} onChange={(e) => setDetails(e.target.value)} fullWidth multiline />
                    <FormControl>
                        <FormLabel>Importance</FormLabel>
                        <Select value={importance} onChange={(e) => setImportance(e.target.value)} fullWidth>
                            <MenuItem value='high'>High</MenuItem>
                            <MenuItem value='medium'>Medium</MenuItem>
                            <MenuItem value='low'>Low</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        label="Expiration Date"
                        type="datetime-local"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        slotProps={{ inputLabel: {shrink: true } }}
                        fullWidth
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button 
                    onClick={handleSubmit} 
                    variant='contained' 
                    color='secondary' 
                    disabled={loading}
                >
                    {loading ? 'Adding...' : 'Add'}
                </Button>
                <Button onClick={onClose}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}