import { useEffect, useState } from 'react';

// Simple mock implementation for now
export interface BusinessAuth {
  user: {
    id: string;
    email: string;
    business_id: string;
  } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useBusinessAuth(): BusinessAuth {
  const [user, setUser] = useState<BusinessAuth['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock auth implementation
    setTimeout(() => {
      setUser({
        id: 'mock-user',
        email: 'test@business.com',
        business_id: 'mock-business-id'
      });
      setLoading(false);
    }, 100);
  }, []);

  const signOut = async () => {
    setUser(null);
  };

  return {
    user,
    loading,
    signOut
  };
}