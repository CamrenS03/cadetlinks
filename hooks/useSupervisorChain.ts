import { useCallback } from 'react';
import { db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface UserHierarchy {
  id: string;
  supervisorIds: string[];
  superviseeIds: string[];
}

/**
 * Hook for checking if one user is in another user's supervisor chain
 * Enables edit permissions for supervisors of event creators
 */
export const useSupervisorChain = () => {
  const getUserHierarchy = useCallback(async (userId: string): Promise<UserHierarchy> => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const data = userDoc.data();

    return {
      id: userId,
      supervisorIds: data?.supervisorIds || [],
      superviseeIds: data?.superviseeIds || [],
    };
  }, []);

  /**
   * Check if userA is a supervisor of userB (direct or indirect)
   * @param supervisorId - User ID to check if is supervisor
   * @param subordinateId - User ID to check if is subordinate
   * @returns true if supervisorId is in subordinateId's supervisor chain
   */
  const isUserSupervisor = useCallback(
    async (supervisorId: string, subordinateId: string): Promise<boolean> => {
      if (supervisorId === subordinateId) return false;

      const visited = new Set<string>();
      const queue: string[] = [subordinateId];

      while (queue.length > 0) {
        const currentId = queue.shift()!;

        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const hierarchy = await getUserHierarchy(currentId);

        if (hierarchy.supervisorIds.includes(supervisorId)) {
          return true;
        }

        // Add supervisors to queue for BFS
        for (const supId of hierarchy.supervisorIds) {
          if (!visited.has(supId)) {
            queue.push(supId);
          }
        }
      }

      return false;
    },
    [getUserHierarchy]
  );

  /**
   * Check if userA can edit content created by userB
   * Allowed if: userA is creator OR userA is in creator's supervisor chain
   */
  const canEditUserContent = useCallback(
    async (currentUserId: string, creatorId: string): Promise<boolean> => {
      if (currentUserId === creatorId) return true;
      return await isUserSupervisor(currentUserId, creatorId);
    },
    [isUserSupervisor]
  );

  return {
    getUserHierarchy,
    isUserSupervisor,
    canEditUserContent,
  };
};
