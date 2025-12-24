// Client API per autenticazione custom

const API_BASE = '/api/auth';

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
function getAuthHeaders(): HeadersInit {
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
  }): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        organizationName: data.organizationName
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
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Errore nel login');
    }

    return response.json();
  },

  // Verifica email
  verifyEmail: async (code: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/verify-email`, {
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
    const response = await fetch(`${API_BASE}/resend-verification`, {
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
    const response = await fetch(`${API_BASE}/request-password-reset`, {
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
    const response = await fetch(`${API_BASE}/reset-password`, {
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
    const response = await fetch(`${API_BASE}/me`, {
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
    const response = await fetch(`${API_BASE}/me`, {
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

  // Cambia password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/change-password`, {
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
  },

  // Verifica se autenticato
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      // Verifica scadenza JWT
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Math.floor(Date.now() / 1000);
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
