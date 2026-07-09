import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { db } from '../firebase/firebase';

interface Job {
  id: string;
  title: string;
  description?: string;
  organizationLevel: number;
  permissions: string[];
  parentJobId?: string;
  childJobIds: string[];
  createdAt?: Date;
}

interface UserData {
  uid: string;
  email: string;
  phone?: string;
  displayName: string;
  photoURL?: string;
  classYear?: string;
  flight?: string;
  rank?: string;
  jobId: string;
  supervisorIds: string[];
  superviseeIds: string[];
  lastSignIn?: Date;
}

/**
 * Hook to get the current user's profile and job information.
 * Provides access to permissions, job details, and supervisor relationships.
 *
 * For looking up *other* users by id, use the app-wide cache in AppDataContext
 * (useAppData) rather than adding per-hook caches.
 */
export const useUser = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userJob, setUserJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      setUserJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to user document changes in real-time
    const unsubscribeUser = onSnapshot(
      doc(db, 'users', currentUser.uid),
      async (userDoc) => {
        try {
          if (!userDoc.exists()) {
            setError('User document not found');
            setUserData(null);
            setUserJob(null);
            setLoading(false);
            return;
          }

          const data = userDoc.data() as UserData;
          setUserData(data);

          // Fetch job information if jobId exists
          if (data.jobId) {
            const jobDoc = await getDoc(doc(db, 'jobs', data.jobId));
            if (jobDoc.exists()) {
              const jobData = jobDoc.data() as Job;
              const { id: _, ...jobFields } = jobData;
              setUserJob({
                id: jobDoc.id,
                ...jobFields,
              });
            } else {
              setError('Job document not found');
              setUserJob(null);
            }
          }

          setError(null);
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user data');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to user document:', err);
        setError('Failed to listen to user changes');
        setLoading(false);
      }
    );

    return unsubscribeUser;
  }, [currentUser]);

  /**
   * Check if current user has a specific permission
   */
  const hasPermission = (permissionName: string): boolean => {
    if (!userJob) return false;
    return userJob.permissions?.includes(permissionName) ?? false;
  };

  /**
   * Get all of current user's permissions
   */
  const getPermissions = (): string[] => {
    return userJob?.permissions ?? [];
  };

  /**
   * Check if current user is an admin (has at least one permission)
   */
  const isAdmin = (): boolean => {
    return (userJob?.permissions?.length ?? 0) > 0;
  };

  return {
    // Current user data
    userData,
    userJob,
    loading,
    error,

    // Utility functions
    hasPermission,
    getPermissions,
    isAdmin,

    // Supervisor relationships
    supervisorIds: userData?.supervisorIds ?? [],
    superviseeIds: userData?.superviseeIds ?? [],
  };
};
