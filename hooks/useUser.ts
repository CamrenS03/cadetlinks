import { useEffect, useState } from 'react';
import { db } from '../firebase/firebase';
import { useAuth } from '../firebase/AuthContext'
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
 * Hook to get current user's profile and job information
 * Provides access to permissions, job details, and supervisor relationships
 */
export const useUser = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userJob, setUserJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache for user lookups to avoid redundant queries
  const [userCache, setUserCache] = useState<Map<string, UserData>>(new Map());

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

          // Cache this user
          setUserCache((prev) => new Map(prev).set(currentUser.uid, data));

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
   * Get a user's display name by ID
   * Uses cache first to avoid redundant Firestore queries
   */
  const getUserNameById = async (userId: string): Promise<string> => {
    if (!userId) return 'Unknown User';

    // Check cache first
    if (userCache.has(userId)) {
      const cachedUser = userCache.get(userId);
      return cachedUser?.displayName || userId;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const user = userDoc.data() as UserData;
        // Cache the result
        setUserCache((prev) => new Map(prev).set(userId, user));
        return user.displayName || user.email || userId;
      }
      return userId;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err);
      return userId;
    }
  };

  /**
   * Get a user's full data by ID
   * Uses cache first to avoid redundant Firestore queries
   */
  const getUserById = async (userId: string): Promise<UserData | null> => {
    if (!userId) return null;

    // Check cache first
    if (userCache.has(userId)) {
      return userCache.get(userId) || null;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const user = userDoc.data() as UserData;
        // Cache the result
        setUserCache((prev) => new Map(prev).set(userId, user));
        return user;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err);
      return null;
    }
  };

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

  /**
   * Clear user cache (useful after user updates)
   */
  const clearCache = () => {
    setUserCache(new Map());
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
    getUserNameById,
    getUserById,
    clearCache,

    // Supervisor relationships
    supervisorIds: userData?.supervisorIds ?? [],
    superviseeIds: userData?.superviseeIds ?? [],
  };
};
