export interface Business {
  id: string;
  name: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  owner_id: string;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessRequest {
  name: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
}

export interface UpdateBusinessRequest {
  name?: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
}