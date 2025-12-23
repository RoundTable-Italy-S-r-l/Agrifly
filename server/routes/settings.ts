import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../routes/auth-custom'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const router = Router()

// Auth middleware applied per route

// ============================================================================
// ORGANIZATION GENERAL SETTINGS
// ============================================================================

const updateOrganizationSchema = z.object({
  legal_name: z.string().min(1),
  vat_number: z.string().optional(),
  tax_code: z.string().optional(),
  org_type: z.enum(['FARM', 'VENDOR', 'OPERATOR_PROVIDER']),
  address_line: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  region: z.string().min(1),
  country: z.string().default('IT'),
})

// GET /settings/organization/general - Get organization general settings
router.get('/organization/general', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
      include: {
        org: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    res.json(membership.org)
  } catch (error) {
    console.error('Error fetching organization general settings:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /settings/organization/general - Update organization general settings
router.patch('/organization/general', requireAuth, async (req, res) => {
  try {
    
    const userId = req.user!.userId
    const validatedData = updateOrganizationSchema.parse(req.body)

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
      include: {
        org: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Check if user has admin role
    const allowedRoles = ['BUYER_ADMIN', 'VENDOR_ADMIN']
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Update organization
    const updatedOrg = await prisma.organization.update({
      where: { id: membership.org_id },
      data: validatedData,
    })

    res.json(updatedOrg)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    console.error('Error updating organization general settings:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// ORGANIZATION USERS MANAGEMENT
// ============================================================================

// GET /settings/organization/users - Get organization users
router.get('/organization/users', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Get all active members of the organization
    const members = await prisma.orgMembership.findMany({
      where: {
        org_id: membership.org_id,
        is_active: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            status: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc',
      },
    })

    // Format response
    const users = members.map(member => ({
      id: member.user.id,
      email: member.user.email,
      first_name: member.user.first_name,
      last_name: member.user.last_name,
      status: member.user.status,
      membership: {
        role: member.role,
        is_active: member.is_active,
        created_at: member.created_at,
      },
    }))

    res.json(users)
  } catch (error) {
    console.error('Error fetching organization users:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// ORGANIZATION INVITATIONS MANAGEMENT
// ============================================================================

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['BUYER_ADMIN', 'VENDOR_ADMIN', 'DISPATCHER', 'PILOT', 'SALES']),
})

// GET /settings/organization/invitations - Get organization invitations
router.get('/organization/invitations', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Check if user has admin role
    const allowedRoles = ['BUYER_ADMIN', 'VENDOR_ADMIN']
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Get all invitations for the organization
    const invitations = await prisma.organizationInvitation.findMany({
      where: {
        organization_id: membership.org_id,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    // Calculate status based on current time and acceptance
    const now = new Date()
    const invitationsWithStatus = invitations.map(invitation => {
      let status = 'PENDING'
      if (invitation.accepted_at) {
        status = 'ACCEPTED'
      } else if (invitation.expires_at < now) {
        status = 'EXPIRED'
      }

      return {
        ...invitation,
        status,
      }
    })

    res.json(invitationsWithStatus)
  } catch (error) {
    console.error('Error fetching organization invitations:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /settings/organization/invitations/invite - Invite user to organization
router.post('/organization/invitations/invite', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId
    const { email, role } = inviteUserSchema.parse(req.body)

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
      include: {
        org: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Check if user has admin role
    const allowedRoles = ['BUYER_ADMIN', 'VENDOR_ADMIN']
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Check if user is already a member
    const existingMember = await prisma.orgMembership.findFirst({
      where: {
        org_id: membership.org_id,
        user: {
          email: email,
        },
        is_active: true,
      },
    })

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this organization' })
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        organization_id: membership.org_id,
        email: email,
        accepted_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
    })

    if (existingInvitation) {
      return res.status(400).json({ error: 'There is already a pending invitation for this email' })
    }

    // Generate token
    const token = randomBytes(32).toString('hex')

    // Create invitation (expires in 7 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organization_id: membership.org_id,
        email: email,
        token: token,
        role: role,
        invited_by_user_id: userId,
        expires_at: expiresAt,
      },
    })

    // TODO: Send email invitation
    // For now, just log the invitation link
    console.log(`Invitation created for ${email}: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}`)

    res.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    console.error('Error creating invitation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /settings/organization/invitations/revoke/:id - Revoke invitation
router.post('/organization/invitations/revoke/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId
    const invitationId = req.params.id

    // Get user's organization through membership
    const membership = await prisma.orgMembership.findFirst({
      where: {
        user_id: userId,
        is_active: true,
      },
    })

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Check if user has admin role
    const allowedRoles = ['BUYER_ADMIN', 'VENDOR_ADMIN']
    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    // Find and delete the invitation
    const invitation = await prisma.organizationInvitation.findFirst({
      where: {
        id: invitationId,
        organization_id: membership.org_id,
        accepted_at: null, // Only revoke pending invitations
      },
    })

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found or already accepted' })
    }

    await prisma.organizationInvitation.delete({
      where: { id: invitationId },
    })

    res.json({ message: 'Invitation revoked successfully' })
  } catch (error) {
    console.error('Error revoking invitation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// USER NOTIFICATION PREFERENCES
// ============================================================================

const notificationPreferencesSchema = z.object({
  email_orders: z.boolean().default(true),
  email_payments: z.boolean().default(true),
  email_updates: z.boolean().default(false),
  inapp_orders: z.boolean().default(true),
  inapp_messages: z.boolean().default(true),
})

// GET /settings/notifications - Get user notification preferences
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId

    // Try to find existing preferences using simple query
    const preferences = await prisma.userNotificationPreferences.findFirst({
      where: { user_id: userId }
    })

    if (!preferences) {
      // Create default preferences
      const newPreferences = await prisma.userNotificationPreferences.create({
        data: {
          user_id: userId,
          email_orders: true,
          email_payments: true,
          email_updates: false,
          inapp_orders: true,
          inapp_messages: true,
        }
      })
      return res.json(newPreferences)
    }

    res.json(preferences)
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// PUT /settings/notifications - Update user notification preferences
router.put('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId
    const validatedData = notificationPreferencesSchema.parse(req.body)

    // Check if preferences exist
    const existing = await prisma.userNotificationPreferences.findFirst({
      where: { user_id: userId }
    })

    let preferences
    if (existing) {
      // Update existing preferences
      preferences = await prisma.userNotificationPreferences.update({
        where: { id: existing.id },
        data: validatedData
      })
    } else {
      // Create new preferences
      preferences = await prisma.userNotificationPreferences.create({
        data: {
          user_id: userId,
          ...validatedData
        }
      })
    }

    res.json(preferences)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors })
    }
    console.error('Error updating notification preferences:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
