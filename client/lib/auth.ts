// Client API per autenticazione custom

const API_BASE = '/api';

// Tipi per le risposte API
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    email_verified: boolean;
  };
  organization: {
    id: string;
    name: string;
    role: string;
    isAdmin: boolean;
  };
}

export interface UserProfile {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    email_verified: boolean;
  };
  organization: {
    id: string;
    name: string;
    role: string;
    isAdmin: boolean;
  };
}

// Utility per ottenere headers con JWT
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// API Functions

export const authAPI = {
  // Registrazione
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationName?: string;
    accountType?: 'buyer' | 'vendor' | 'operator';
  }): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        organizationName: data.organizationName,
        accountType: data.accountType || 'buyer'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nella registrazione');
    }

    return response.json();
  },

  // Login
  login: async (email: string, password: string): Promise<AuthResponse> => {
    console.log('🔐 [FRONTEND LOGIN] Sending request to:', `${API_BASE}/auth/login`);
    console.log('🔐 [FRONTEND LOGIN] Request body:', { email, hasPassword: !!password });

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    console.log('🔐 [FRONTEND LOGIN] Response status:', response.status);
    console.log('🔐 [FRONTEND LOGIN] Response ok:', response.ok);

    if (!response.ok) {
      try {
        const error = await response.json();
        console.log('🔐 [FRONTEND LOGIN] Error response:', error);
        throw new Error(error.error || 'Errore nel login');
      } catch (parseError) {
        console.log('🔐 [FRONTEND LOGIN] Failed to parse error response:', parseError);
        throw new Error('Errore nel login - risposta non valida');
      }
    }

    try {
      const data = await response.json();
      console.log('🔐 [FRONTEND LOGIN] Success response received');
      return data;
    } catch (parseError) {
      console.log('🔐 [FRONTEND LOGIN] Failed to parse success response:', parseError);
      throw new Error('Risposta del server non valida');
    }
  },

  // Verifica email
  verifyEmail: async (code: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nella verifica email');
    }

    return response.json();
  },

  // Reinvia codice verifica
  resendVerification: async (): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nell\'invio del codice');
    }

    return response.json();
  },

  // Richiesta reset password
  requestPasswordReset: async (email: string): Promise<{ message: string; resetUrl?: string; warning?: string }> => {
    const response = await fetch(`${API_BASE}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nella richiesta reset');
    }

    return response.json();
  },

  // Reset password
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nel reset password');
    }

    return response.json();
  },

  // Ottieni profilo utente
  getProfile: async (): Promise<UserProfile> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nel caricamento profilo');
    }

    return response.json();
  },

  // Aggiorna profilo
  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<UserProfile> => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nell\'aggiornamento profilo');
    }

    return response.json();
  },

  // Cambia password (endpoint non ancora implementato nel backend)
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nel cambio password');
    }

    return response.json();
  },

  // Logout (client-side)
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('organization');
    localStorage.removeItem('user');
    // Notifica il cambio di autenticazione
    window.dispatchEvent(new Event('authChanged'));
  },

  // Verifica se autenticato
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('auth_token');
    const organization = localStorage.getItem('organization');

    if (!token || !organization) {
      return false;
    }

    try {
      // Supporta sia JWT custom ({body}.{signature}) che JWT standard ({header}.{body}.{signature})
      const parts = token.split('.');
      if (parts.length !== 2 && parts.length !== 3) {
        return false;
      }

      // Per JWT standard, prendi la seconda parte (body), per custom prendi la prima
      const body = parts.length === 3 ? parts[1] : parts[0];
      // Converti base64url a base64 standard
      const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
      // Padding
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      // Decodifica
      const decoded = atob(padded);
      const payload = JSON.parse(decoded);
      const now = Math.floor(Date.now() / 1000);

      return payload.exp > now;
    } catch {
      return false;
    }
  },

  // Ottieni token corrente
  getToken: (): string | null => {
    return localStorage.getItem('auth_token');
  },

  // Ottieni organizzazione corrente
  getOrganization: (): any => {
    const org = localStorage.getItem('organization');
    return org ? JSON.parse(org) : null;
  }
};
