import { RequestHandler } from "express";
import { hashPassword, verifyPassword, generateJWT, generateVerificationCode, generateSecureToken } from "../utils/auth";
import { sendVerificationCodeEmail, sendWelcomeEmail, sendPasswordResetEmail, sendOrganizationInvitationEmail } from "../utils/email";
import { handlePrismaError } from "../utils/error-handler";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { prisma } from "../utils/prisma";
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Invia codice verifica email
export const sendVerificationCode: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email non valida' });
    }

    // Genera codice 6 cifre
    const code = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Valido 10 minuti

    // Salva codice nel database
    await prisma.verificationCode.create({
      data: {
        email,
        code,
        purpose: 'EMAIL_VERIFICATION',
        expires_at: expiresAt,
      },
    });

    // Invia email
    await sendVerificationCodeEmail(email, code, 10);

    res.json({ message: 'Codice di verifica inviato' });
  } catch (error: any) {
    handlePrismaError(error, res, { error: 'Errore nell\'invio del codice' });
  }
};

// Registrazione
export const register: RequestHandler = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, verification_code, invitation_token } = req.body;

    // Verifica codice se presente
    if (verification_code) {
      const codeRecord = await prisma.verificationCode.findFirst({
        where: {
          email,
          code: verification_code,
          purpose: 'EMAIL_VERIFICATION',
          used: false,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: 'desc' },
      });

      if (!codeRecord) {
        return res.status(400).json({ error: 'Codice di verifica non valido o scaduto' });
      }

      // Marca codice come usato
      await prisma.verificationCode.update({
        where: { id: codeRecord.id },
        data: { used: true, used_at: new Date() },
      });
    }

    // Verifica se email esiste già
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Hash password
    const password_hash = password ? hashPassword(password) : null;

    // Crea utente
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        first_name,
        last_name,
        phone,
        email_verified: verification_code ? true : false,
        email_verified_at: verification_code ? new Date() : null,
      },
    });

    let organizationId: string | null = null;
    let role: string = 'BUYER_ADMIN';

    // Gestisci invito organization se presente
    if (invitation_token) {
      const invitation = await prisma.organizationInvitation.findFirst({
        where: {
          token: invitation_token,
          email,
          expires_at: { gt: new Date() },
          accepted_at: null,
        },
      });

      if (invitation) {
        organizationId = invitation.organization_id;
        role = invitation.role;

        // Marca invito come accettato
        await prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { accepted_at: new Date() },
        });
      }
    }

    // Se non c'è invito, crea nuova organization (come primo utente)
    if (!organizationId) {
      const newOrg = await prisma.organization.create({
        data: {
          legal_name: `${first_name} ${last_name}`,
          org_type: 'FARM',
          address_line: '',
          city: '',
          province: '',
          region: '',
          country: 'IT',
          status: 'ACTIVE',
        },
      });
      organizationId = newOrg.id;
      role = 'BUYER_ADMIN'; // Primo utente è admin
    }

    // Crea membership
    await prisma.orgMembership.create({
      data: {
        org_id: organizationId,
        user_id: user.id,
        role: role as any,
        is_active: true,
      },
    });

    // Invia email benvenuto (non bloccare se fallisce)
    try {
      const userName = `${first_name} ${last_name}` || email.split('@')[0];
      await sendWelcomeEmail(email, userName, `${FRONTEND_URL}/login`);
    } catch (emailError) {
      console.warn('⚠️  Errore invio email benvenuto (non bloccante):', emailError);
    }

    // Genera JWT
    const isAdmin = role === 'BUYER_ADMIN' || role === 'VENDOR_ADMIN';
    const token = generateJWT({
      userId: user.id,
      orgId: organizationId!,
      role,
      isAdmin,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      organization: {
        id: organizationId,
        role,
        isAdmin,
      },
    });
  } catch (error: any) {
    console.error('❌ Errore registrazione:', error);
    handlePrismaError(error, res, { error: 'Errore nella registrazione' });
  }
};

// Login
export const login: RequestHandler = async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { email: req.body?.email, hasPassword: !!req.body?.password });
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email e password richieste' });
    }

    // Trova utente
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    console.log('✅ User found:', user.id, 'Memberships:', user.org_memberships.length);

    // Verifica password
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      console.log('❌ Password verification failed');
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    console.log('✅ Password verified');

    // Verifica status
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account bloccato' });
    }

    // Se ha più organizations, ritorna lista (frontend chiederà selezione)
    if (user.org_memberships.length > 1) {
      console.log('📋 Multiple organizations, returning selection');
      return res.json({
        requiresOrgSelection: true,
        organizations: user.org_memberships.map(m => ({
          id: m.org.id,
          name: m.org.legal_name,
          role: m.role,
          isAdmin: m.role === 'BUYER_ADMIN' || m.role === 'VENDOR_ADMIN',
        })),
      });
    }

    // Se ha una sola organization, genera JWT direttamente
    if (user.org_memberships.length === 1) {
      const membership = user.org_memberships[0];
      const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';
      const token = generateJWT({
        userId: user.id,
        orgId: membership.org_id,
        role: membership.role,
        isAdmin,
      });

      console.log('✅ Login successful, token generated');
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        organization: {
          id: membership.org.id,
          name: membership.org.legal_name,
          role: membership.role,
          isAdmin,
        },
      });
    }

    // Nessuna organization (caso edge)
    console.log('❌ User has no organizations');
    return res.status(400).json({ error: 'Utente non associato ad alcuna organization' });
  } catch (error: any) {
    console.error('❌ Login error:', error);
    handlePrismaError(error, res, { error: 'Errore nel login' });
  }
};

// Selezione organization dopo login (se multiple)
export const selectOrganization: RequestHandler = async (req, res) => {
  try {
    const { email, organization_id } = req.body;

    if (!email || !organization_id) {
      return res.status(400).json({ error: 'Email e organization_id richieste' });
    }

    // Trova utente e membership
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        org_memberships: {
          where: {
            org_id: organization_id,
            is_active: true,
          },
          include: {
            org: true,
          },
        },
      },
    });

    if (!user || user.org_memberships.length === 0) {
      return res.status(404).json({ error: 'Organization non trovata per questo utente' });
    }

    const membership = user.org_memberships[0];
    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';
    const token = generateJWT({
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      organization: {
        id: membership.org.id,
        name: membership.org.legal_name,
        role: membership.role,
        isAdmin,
      },
    });
  } catch (error: any) {
    handlePrismaError(error, res, { error: 'Errore nella selezione organization' });
  }
};

// Request password reset
export const requestPasswordReset: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email richiesta' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Per sicurezza, non rivelare se l'email esiste
      return res.json({ message: 'Se l\'email esiste, riceverai un link per il reset' });
    }

    // Genera token reset
    const reset_token = generateSecureToken();
    const reset_token_expires = new Date();
    reset_token_expires.setHours(reset_token_expires.getHours() + 1); // Valido 1 ora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token,
        reset_token_expires,
      },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${reset_token}`;
    await sendPasswordResetEmail(email, resetUrl);

    res.json({ message: 'Se l\'email esiste, riceverai un link per il reset' });
  } catch (error: any) {
    handlePrismaError(error, res, { error: 'Errore nella richiesta reset' });
  }
};

// Reset password
export const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token e nuova password richieste' });
    }

    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_expires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    // Aggiorna password
    const password_hash = hashPassword(new_password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        reset_token: null,
        reset_token_expires: null,
      },
    });

    res.json({ message: 'Password resettata con successo' });
  } catch (error: any) {
    handlePrismaError(error, res, { error: 'Errore nel reset password' });
  }
};

// OAuth Google - Inizia flusso
export const googleAuth: RequestHandler = async (req, res) => {
  const redirectUri = encodeURIComponent(
    `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/auth/google/callback`
  );
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const scope = encodeURIComponent('openid email profile');
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  
  res.redirect(authUrl);
};

// OAuth Google callback
export const googleCallback: RequestHandler = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code mancante' });
    }

    // Scambia code con access_token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Errore nell\'ottenere access token' });
    }

    // Richiedi info profilo
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileResponse.json();

    // Cerca o crea utente
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.email },
          { oauth_provider: 'GOOGLE', oauth_id: profile.id },
        ],
      },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: { org: true },
        },
      },
    });

    if (!user) {
      // Crea nuovo utente
      user = await prisma.user.create({
        data: {
          email: profile.email,
          first_name: profile.given_name || '',
          last_name: profile.family_name || '',
          oauth_provider: 'GOOGLE',
          oauth_id: profile.id,
          email_verified: true,
          email_verified_at: new Date(),
        },
        include: {
          org_memberships: {
            where: { is_active: true },
            include: { org: true },
          },
        },
      });

      // Crea organization per nuovo utente
      const newOrg = await prisma.organization.create({
        data: {
          legal_name: `${user.first_name} ${user.last_name}` || profile.email.split('@')[0],
          org_type: 'FARM',
          address_line: '',
          city: '',
          province: '',
          region: '',
          country: 'IT',
          status: 'ACTIVE',
        },
      });

      await prisma.orgMembership.create({
        data: {
          org_id: newOrg.id,
          user_id: user.id,
          role: 'BUYER_ADMIN',
          is_active: true,
        },
      });

      // Ricarica user con membership
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          org_memberships: {
            where: { is_active: true },
            include: { org: true },
          },
        },
      })!;
    } else {
      // Aggiorna oauth info se mancante
      if (!user.oauth_provider) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            oauth_provider: 'GOOGLE',
            oauth_id: profile.id,
            email_verified: true,
            email_verified_at: new Date(),
          },
        });
      }
    }

    // Se ha più organizations, redirect a selezione
    if (user!.org_memberships.length > 1) {
      return res.redirect(`${FRONTEND_URL}/select-organization?email=${user!.email}`);
    }

    // Genera JWT e redirect
    const membership = user!.org_memberships[0];
    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';
    const token = generateJWT({
      userId: user!.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error: any) {
    console.error('OAuth Google error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
};

// OAuth Microsoft - Inizia flusso
export const microsoftAuth: RequestHandler = async (req, res) => {
  const redirectUri = encodeURIComponent(
    `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/auth/microsoft/callback`
  );
  const clientId = process.env.MICROSOFT_CLIENT_ID || '';
  const scope = encodeURIComponent('User.Read');
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}`;
  
  res.redirect(authUrl);
};

// OAuth Microsoft callback
export const microsoftCallback: RequestHandler = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code mancante' });
    }

    // Scambia code con access_token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:8080'}/api/auth/microsoft/callback`,
        grant_type: 'authorization_code',
        scope: 'User.Read',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Errore nell\'ottenere access token' });
    }

    // Richiedi info profilo Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileResponse.json();

    // Cerca o crea utente
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: profile.mail || profile.userPrincipalName },
          { oauth_provider: 'MICROSOFT', oauth_id: profile.id },
        ],
      },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: { org: true },
        },
      },
    });

    if (!user) {
      // Crea nuovo utente
      const email = profile.mail || profile.userPrincipalName;
      const nameParts = (profile.displayName || '').split(' ');
      user = await prisma.user.create({
        data: {
          email,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          oauth_provider: 'MICROSOFT',
          oauth_id: profile.id,
          email_verified: true,
          email_verified_at: new Date(),
        },
        include: {
          org_memberships: {
            where: { is_active: true },
            include: { org: true },
          },
        },
      });

      // Crea organization per nuovo utente
      const newOrg = await prisma.organization.create({
        data: {
          legal_name: profile.displayName || email.split('@')[0],
          org_type: 'FARM',
          address_line: '',
          city: '',
          province: '',
          region: '',
          country: 'IT',
          status: 'ACTIVE',
        },
      });

      await prisma.orgMembership.create({
        data: {
          org_id: newOrg.id,
          user_id: user.id,
          role: 'BUYER_ADMIN',
          is_active: true,
        },
      });

      // Ricarica user con membership
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          org_memberships: {
            where: { is_active: true },
            include: { org: true },
          },
        },
      })!;
    } else {
      // Aggiorna oauth info se mancante
      if (!user.oauth_provider) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            oauth_provider: 'MICROSOFT',
            oauth_id: profile.id,
            email_verified: true,
            email_verified_at: new Date(),
          },
        });
      }
    }

    // Se ha più organizations, redirect a selezione
    if (user!.org_memberships.length > 1) {
      return res.redirect(`${FRONTEND_URL}/select-organization?email=${user!.email}`);
    }

    // Genera JWT e redirect
    const membership = user!.org_memberships[0];
    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';
    const token = generateJWT({
      userId: user!.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error: any) {
    console.error('OAuth Microsoft error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
};

// Scambia token Supabase con JWT nostro + organizzazione
export const exchangeSupabaseToken: RequestHandler = async (req, res) => {
  try {
    const { supabaseToken } = req.body;

    if (!supabaseToken) {
      return res.status(400).json({ error: 'Token Supabase richiesto' });
    }

    console.log('🔄 Scambio token Supabase...');

    // Verifica token Supabase (da implementare con Supabase Admin SDK)
    // Per ora, assumiamo che sia valido e cerchiamo l'utente per email
    // TODO: Implementare verifica reale del token Supabase

    // Per ora, workaround: prendiamo l'utente da email nel body
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email richiesta per scambio token' });
    }

    console.log('🔍 Cerco utente per email:', email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ Utente non trovato:', email);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    console.log('✅ Utente trovato:', user.email);

    if (user.org_memberships.length !== 1) {
      console.log('❌ Utente deve avere esattamente una organizzazione attiva, ne ha:', user.org_memberships.length);
      return res.status(400).json({ error: 'Configurazione organizzazioni non valida' });
    }

    const membership = user.org_memberships[0];
    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';

    console.log('✅ Organizzazione trovata:', membership.org.legal_name, 'ruolo:', membership.role);

    // Genera JWT nostro
    const token = generateJWT({
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
    });

    console.log('✅ JWT generato per user:', user.id);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      organization: {
        id: membership.org.id,
        name: membership.org.legal_name,
        role: membership.role,
        isAdmin,
      },
    });

  } catch (error: any) {
    console.error('❌ Errore scambio token:', error);
    handlePrismaError(error, res, { error: 'Errore nello scambio del token' });
  }
};

// Ottieni info utente corrente con organizzazione
export const getCurrentUser: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    console.log('🔍 getCurrentUser chiamato per userId:', userId);

    if (!userId) {
      console.log('❌ userId mancante nella request');
      return res.status(401).json({ error: 'Non autenticato' });
    }

    // Trova utente con memberships attivi
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ Utente non trovato:', userId);
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    console.log('✅ Utente trovato:', user.email, 'con', user.org_memberships.length, 'organizzazioni');

    // Se ha più organizzazioni, richiedi selezione (caso edge)
    if (user.org_memberships.length > 1) {
      console.log('📋 Più organizzazioni, richiedi selezione');
      return res.json({
        requiresOrgSelection: true,
        organizations: user.org_memberships.map(m => ({
          id: m.org.id,
          name: m.org.legal_name,
          role: m.role,
        })),
      });
    }

    // Se ha una sola organizzazione, restituisci direttamente
    if (user.org_memberships.length === 1) {
      const membership = user.org_memberships[0];
      const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';

      console.log('✅ Una organizzazione trovata:', membership.org.legal_name, 'ruolo:', membership.role);

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        organization: {
          id: membership.org.id,
          name: membership.org.legal_name,
          role: membership.role,
          isAdmin,
        },
      });
    }

    // Nessuna organizzazione attiva
    console.log('❌ Nessuna organizzazione attiva per utente');
    return res.status(400).json({ error: 'Utente non associato ad alcuna organization' });
  } catch (error: any) {
    console.error('❌ Errore recupero utente corrente:', error);
    handlePrismaError(error, res, { error: 'Errore nel recupero delle informazioni utente' });
  }
};

// Associa utente corrente a Lenzi (endpoint di utilità)
export const associateWithLenzi: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Non autenticato' });
    }

    // Verifica se Lenzi esiste
    const lenzi = await prisma.organization.findUnique({
      where: { id: 'lenzi-org-id' }
    });

    if (!lenzi) {
      return res.status(404).json({ error: 'Organizzazione Lenzi non trovata' });
    }

    // Verifica se l'utente è già membro
    const existingMembership = await prisma.orgMembership.findUnique({
      where: {
        org_id_user_id: {
          org_id: 'lenzi-org-id',
          user_id: userId
        }
      }
    });

    if (existingMembership) {
      // Se esiste ma non è attivo, attivalo
      if (!existingMembership.is_active) {
        await prisma.orgMembership.update({
          where: { id: existingMembership.id },
          data: { is_active: true }
        });
      }
      return res.json({ 
        message: 'Già associato a Lenzi',
        membership: existingMembership 
      });
    }

    // Crea nuovo membership
    const membership = await prisma.orgMembership.create({
      data: {
        org_id: 'lenzi-org-id',
        user_id: userId,
        role: 'VENDOR_ADMIN',
        is_active: true
      }
    });

    res.json({ 
      message: 'Associato a Lenzi con successo',
      membership 
    });
  } catch (error: any) {
    console.error('Errore associazione Lenzi:', error);
    handlePrismaError(error, res, { error: 'Errore nell\'associazione a Lenzi' });
  }
};

// Invita utente a organization
export const inviteToOrganization: RequestHandler = async (req: AuthRequest, res) => {
  try {
    const { organization_id, email, role } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Non autenticato' });
    }

    // Verifica permessi (deve essere admin dell'organization)
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        org_id: organization_id,
        is_active: true,
        role: { in: ['BUYER_ADMIN', 'VENDOR_ADMIN'] },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Non autorizzato a invitare in questa organization' });
    }

    // Genera token invito
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Valido 7 giorni

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organization_id,
        email,
        token,
        role: role || 'BUYER_ADMIN',
        invited_by_user_id: userId,
        expires_at: expiresAt,
      },
      include: {
        organization: true,
        invited_by: true,
      },
    });

    // Invia email invito
    const inviteUrl = `${FRONTEND_URL}/register?token=${token}`;
    await sendOrganizationInvitationEmail(
      email,
      `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`,
      invitation.organization.legal_name,
      inviteUrl
    );

    res.json({ message: 'Invito inviato', invitation: { id: invitation.id, email: invitation.email } });
  } catch (error: any) {
    handlePrismaError(error, res, { error: 'Errore nell\'invio dell\'invito' });
  }
};
