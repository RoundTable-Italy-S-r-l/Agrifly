import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// API helper - similar to the apiRequest function in lib/api.ts
const API_BASE = '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;

  // Get auth token from localStorage
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      ...options,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${(error as Error).message}`);
  }
}

// API object with methods
const api = {
  get: <T>(endpoint: string): Promise<T> => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, data?: any): Promise<T> =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(endpoint: string, data?: any): Promise<T> =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string): Promise<T> =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),
};

// Organization General Settings
export function useOrganizationGeneral() {
  return useQuery({
    queryKey: ['organization', 'general'],
    queryFn: async () => {
      const response = await api.get('/settings/organization/general')
      return response
    },
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.status === 401 || error?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateOrganizationGeneral() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.patch('/settings/organization/general', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'general'] })
    },
  })
}

// Organization Users
export function useOrganizationUsers() {
  return useQuery({
    queryKey: ['organization', 'users'],
    queryFn: async () => {
      const response = await api.get('/settings/organization/users')
      return response
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    staleTime: 5 * 60 * 1000,
  })
}

// Organization Invitations
export function useOrganizationInvitations() {
  return useQuery({
    queryKey: ['organization', 'invitations'],
    queryFn: async () => {
      const response = await api.get('/settings/organization/invitations')
      return response
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await api.post('/settings/organization/invitations/invite', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'invitations'] })
    },
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await api.post(`/settings/organization/invitations/revoke/${invitationId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'invitations'] })
    },
  })
}

// ============================================================================
// USER NOTIFICATION PREFERENCES
// ============================================================================

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: async () => {
      const response = await api.get('/settings/notifications')
      return response
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      email_orders?: boolean
      email_payments?: boolean
      email_updates?: boolean
      inapp_orders?: boolean
      inapp_messages?: boolean
    }) => {
      const response = await api.patch('/settings/notifications', data)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
    },
  })
}
