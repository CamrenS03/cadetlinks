import { useState, useCallback, useRef, useEffect } from 'react';
import { db } from '../../../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface CachedUser {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  rank?: string;
  flight?: string;
}

/**
 * Hook for caching user data to avoid redundant Firestore queries
 * Significantly improves performance when displaying multiple users (RSVPs, attendance, etc.)
 */
export const useUserCache = () => {
  const cacheRef = useRef<Map<string, CachedUser>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get user data from cache or Firestore
   * @param userId - User ID to fetch
   * @returns User data or null if not found
   */
  const getUser = useCallback(async (userId: string): Promise<CachedUser | null> => {
    if (!userId) return null;

    // Check cache first
    if (cacheRef.current.has(userId)) {
      return cacheRef.current.get(userId) || null;
    }

    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;

      const data = userDoc.data();
      const user: CachedUser = {
        id: userId,
        displayName: data.displayName || data.email || 'Unknown User',
        email: data.email || '',
        photoURL: data.photoURL,
        rank: data.rank,
        flight: data.flight,
      };

      // Cache the result
      cacheRef.current.set(userId, user);
      return user;
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get multiple users efficiently
   * @param userIds - Array of user IDs to fetch
   * @returns Map of userId -> user data
   */
  const getMultipleUsers = useCallback(
    async (userIds: string[]): Promise<Map<string, CachedUser>> => {
      const result = new Map<string, CachedUser>();

      // Separate cached and uncached users
      const uncachedIds = userIds.filter((id) => !cacheRef.current.has(id));

      // Get cached users
      for (const id of userIds) {
        const cachedUser = cacheRef.current.get(id);
        if (cachedUser) {
          result.set(id, cachedUser);
        }
      }

      // Fetch uncached users
      if (uncachedIds.length > 0) {
        setIsLoading(true);
        try {
          for (const userId of uncachedIds) {
            const user = await getUser(userId);
            if (user) {
              result.set(userId, user);
            }
          }
        } finally {
          setIsLoading(false);
        }
      }

      return result;
    },
    [getUser]
  );

  /**
   * Get just the display name for a user
   * @param userId - User ID
   * @returns Display name or user ID as fallback
   */
  const getUserName = useCallback(
    async (userId: string): Promise<string> => {
      const user = await getUser(userId);
      return user?.displayName || userId;
    },
    [getUser]
  );

  /**
   * Clear the cache (useful after user updates)
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  /**
   * Clear specific user from cache
   */
  const clearUser = useCallback((userId: string) => {
    cacheRef.current.delete(userId);
  }, []);

  return {
    getUser,
    getMultipleUsers,
    getUserName,
    clearCache,
    clearUser,
    isLoading,
    cacheSize: cacheRef.current.size,
  };
};
