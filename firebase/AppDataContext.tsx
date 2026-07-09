import { collection, getDocs } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { compareClassYear } from '../lib/constants';
import { useAuth } from './AuthContext';
import { db } from './firebase';

export interface CachedUser {
    uid: string;
    displayName: string;
    email: string;
    phone: string;
    photoURL?: string;
    classYear?: string;
    flight?: string;
    rank?: string;
    jobId?: string;
    bio?: string;
}

export interface CachedJob {
    id: string;
    title: string;
    permissions: string[];
    parentJobId?: string;
    childJobIds?: string[];
}

interface AppDataContextType {
    users: CachedUser[];
    jobs: CachedJob[];
    usersLoading: boolean;
    jobsLoading: boolean;
    refreshUsers: () => Promise<void>;
    refreshJobs: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
    const { currentUser } = useAuth();

    const [users, setUsers] = useState<CachedUser[]>([]);
    const [jobs, setJobs] = useState<CachedJob[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [jobsLoading, setJobsLoading] = useState(false);

    const refreshUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const snap = await getDocs(collection(db, 'users'));
            const loaded: CachedUser[] = snap.docs.map((d) => ({
                uid: d.id,
                displayName: d.data().displayName ?? d.data().email ?? d.id,
                email: d.data().email ?? '',
                phone: d.data().phone ?? '',
                photoURL: d.data().photoURL,
                classYear: d.data().classYear,
                flight: d.data().flight,
                rank: d.data().rank,
                jobId: d.data().jobId,
                bio: d.data().bio,
            }));
            loaded.sort((a, b) => {
                const cy = compareClassYear(b.classYear, a.classYear);
                return cy !== 0 ? cy : a.displayName.localeCompare(b.displayName);
            });
            setUsers(loaded);
        } catch (err) {
            console.error(err);
        } finally {
            setUsersLoading(false);
        }
    }, []);

    const refreshJobs = useCallback(async () => {
        setJobsLoading(true);
        try {
            const snap = await getDocs(collection(db, 'jobs'));
            const loaded: CachedJob[] = snap.docs.map((d) => ({
                id: d.id,
                title: d.data().title,
                permissions: d.data().permissions ?? [],
                parentJobId: d.data().parentJobId,
                childJobIds: d.data().childJobIds,
            }));
            setJobs(loaded);
        } catch (err) {
            console.error(err);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    // Fetch once on sign-in
    useEffect(() => {
        if (!currentUser) {
            setUsers([]);
            setJobs([]);
            return;
        }
        refreshUsers();
        refreshJobs();
    }, [currentUser]);

    return (
        <AppDataContext.Provider value={{ users, jobs, usersLoading, jobsLoading, refreshUsers, refreshJobs }}>{children}</AppDataContext.Provider>
    );
}

export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
    return ctx;
}