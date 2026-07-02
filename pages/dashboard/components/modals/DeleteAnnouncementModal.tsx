import { collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { db } from '../../../../firebase/firebase'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography
} from '@mui/material'


interface DeleteAnnouncementModalProps {
    open: boolean,
    onClose: () => void,
    id: string,
    onConfirm: (id: string) => void,
    title: string,
    expirationDate: Date | null,
}

export default function DeleteAnnouncementModal({open, onClose, id, onConfirm, title, expirationDate}: DeleteAnnouncementModalProps) {
    const handleConfirm = () => {
        if(id) {
            onConfirm(id);
            onClose();
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogContent>
                <Typography variant='body2'>Are you sure you want to delete this announcement?</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <Typography variant='subtitle2'>{title}</Typography>
                    <Typography variant='subtitle2'>Expires: {expirationDate?.toLocaleDateString()}</Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleConfirm} color='error' variant='contained'>Delete</Button>
                <Button onClick={onClose} variant='outlined'>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}