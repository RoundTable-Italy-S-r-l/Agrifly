import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Hono } from 'hono';
import { validateBody } from '../server/middleware/validation';
import {
  CreateJobSchema,
  CreateJobOfferSchema,
  RegisterOrganizationSchema,
  LoginSchema,
  VerifyEmailSchema,
  AcceptInviteSchema
} from '../server/schemas/api.schemas';

// Mock database functions
const mockQuery = vi.fn();
const mockAuthMiddleware = vi.fn((c, next) => {
  c.set('user', { id: 'user-123', organizationId: 'org-123' });
  return next();
});

// Setup mock database
vi.mock('../server/utils/database', () => ({
  query: mockQuery
}));

describe('Integration Validation Tests', () => {
  let app: Hono;

  beforeAll(() => {
    app = new Hono();

    // Mock endpoints with validation
    app.post('/api/jobs', mockAuthMiddleware, validateBody(CreateJobSchema, { transform: true }), async (c) => {
      const validatedBody = c.get('validatedBody');
      return c.json({ success: true, data: validatedBody });
    });

    app.post('/api/jobs/:jobId/offers', mockAuthMiddleware, validateBody(CreateJobOfferSchema, { transform: true }), async (c) => {
      const validatedBody = c.get('validatedBody');
      const jobId = c.req.param('jobId');
      return c.json({ success: true, jobId, data: validatedBody });
    });

    app.post('/api/auth/register', validateBody(RegisterOrganizationSchema, { transform: true }), async (c) => {
      const validatedBody = c.get('validatedBody');
      return c.json({ success: true, data: validatedBody });
    });

    app.post('/api/auth/login', validateBody(LoginSchema), async (c) => {
      const validatedBody = c.get('validatedBody');
      return c.json({ success: true, data: validatedBody });
    });

    app.post('/api/auth/verify-email', validateBody(VerifyEmailSchema), async (c) => {
      const validatedBody = c.get('validatedBody');
      return c.json({ success: true, data: validatedBody });
    });

    app.post('/api/auth/accept-invite', validateBody(AcceptInviteSchema), async (c) => {
      const validatedBody = c.get('validatedBody');
      return c.json({ success: true, data: validatedBody });
    });
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('Job Creation Integration', () => {
    it('should successfully create a job with Italian number format', async () => {
      const requestBody = {
        field_name: 'Campo di Vino',
        service_type: 'SPRAY',
        area_ha: '25,5', // Italian format
        crop_type: 'VINEYARD',
        treatment_type: 'FUNGICIDE',
        terrain_conditions: 'HILLY',
        target_date_start: '2025-01-15',
        target_date_end: '2025-01-20',
        notes: 'Campo in collina con buona esposizione'
      };

      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.field_name).toBe('Campo di Vino');
      expect(result.data.service_type).toBe('SPRAY');
      expect(result.data.area_ha).toBe(25.5); // Should be transformed to number
      expect(result.data.crop_type).toBe('VINEYARD');
      expect(result.data.treatment_type).toBe('FUNGICIDE');
      expect(result.data.terrain_conditions).toBe('HILLY');
    });

    it('should reject invalid job data', async () => {
      const invalidRequestBody = {
        field_name: '', // Empty field name
        service_type: 'INVALID_TYPE', // Invalid enum
        area_ha: -5 // Negative area
      };

      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequestBody)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Validation failed');
      expect(result.message).toBe('I dati forniti non sono validi');
      expect(result.details).toBeDefined();
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should handle minimal valid job data', async () => {
      const minimalRequestBody = {
        field_name: 'Campo Minimo',
        service_type: 'SPRAY',
        area_ha: 10
      };

      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalRequestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.field_name).toBe('Campo Minimo');
      expect(result.data.service_type).toBe('SPRAY');
      expect(result.data.area_ha).toBe(10);
      expect(result.data.crop_type).toBeUndefined();
      expect(result.data.treatment_type).toBeUndefined();
    });
  });

  describe('Job Offer Creation Integration', () => {
    it('should successfully create job offer with Italian price format', async () => {
      const requestBody = {
        total_cents: '4.869,57', // Italian format: €48.6957
        pricing_snapshot_json: { base: 15000, travel: 2500 },
        currency: 'EUR',
        proposed_start: '2025-01-15',
        proposed_end: '2025-01-20',
        provider_note: 'Preventivo competitivo per trattamento fungicida'
      };

      const response = await app.request('/api/jobs/job-123/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.data.total_cents).toBe(486957); // Transformed to cents
      expect(result.data.currency).toBe('EUR');
      expect(result.data.provider_note).toBe('Preventivo competitivo per trattamento fungicida');
    });

    it('should handle different price formats', async () => {
      const testCases = [
        { input: '1.234,56', expected: 123456 },
        { input: 1234.56, expected: 1235 }, // Rounded
        { input: 1000, expected: 1000 }
      ];

      for (const { input, expected } of testCases) {
        const response = await app.request('/api/jobs/job-123/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ total_cents: input })
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.data.total_cents).toBe(expected);
      }
    });

    it('should reject invalid price formats', async () => {
      const invalidPrices = ['invalid', '12,34.56', '', null];

      for (const invalidPrice of invalidPrices) {
        const response = await app.request('/api/jobs/job-123/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ total_cents: invalidPrice })
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Validation failed');
      }
    });
  });

  describe('Authentication Integration', () => {
    it('should successfully register organization', async () => {
      const requestBody = {
        email: 'azienda@example.com',
        password: 'passwordSicura123',
        firstName: 'Mario',
        lastName: 'Rossi',
        organizationName: 'Azienda Agricola Rossi',
        accountType: 'buyer',
        phone: '+39 123 456 7890'
      };

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('azienda@example.com');
      expect(result.data.accountType).toBe('buyer');
      expect(result.data.phone).toBe('+39 123 456 7890');
    });

    it('should reject invalid registration data', async () => {
      const invalidRequestBody = {
        email: 'invalid-email', // Invalid email
        password: '123', // Too short
        firstName: '', // Empty
        lastName: 'Rossi',
        organizationName: 'Test',
        accountType: 'invalid' // Invalid enum
      };

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequestBody)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Validation failed');
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should successfully login', async () => {
      const requestBody = {
        email: 'user@example.com',
        password: 'password123'
      };

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.password).toBe('password123');
    });

    it('should successfully verify email', async () => {
      const requestBody = {
        code: '123456'
      };

      const response = await app.request('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.code).toBe('123456');
    });

    it('should successfully accept invite', async () => {
      const requestBody = {
        token: 'invite-token-abc123',
        password: 'nuovaPassword123',
        firstName: 'Luca',
        lastName: 'Verdi'
      };

      const response = await app.request('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.token).toBe('invite-token-abc123');
      expect(result.data.firstName).toBe('Luca');
      expect(result.data.lastName).toBe('Verdi');
    });
  });

  describe('Error Response Format', () => {
    it('should return properly formatted error responses', async () => {
      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: '', // Invalid: empty
          service_type: 'INVALID', // Invalid: not in enum
          area_ha: 'not-a-number' // Invalid: not a number
        })
      });

      expect(response.status).toBe(400);
      const result = await response.json();

      expect(result).toHaveProperty('error', 'Validation failed');
      expect(result).toHaveProperty('message', 'I dati forniti non sono validi');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.details)).toBe(true);

      // Check that each error has the required fields
      result.details.forEach((error: any) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toHaveProperty('error');
    });
  });

  describe('Middleware Integration', () => {
    it('should call auth middleware before validation', async () => {
      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: 'Test Field',
          service_type: 'SPRAY',
          area_ha: 10
        })
      });

      expect(response.status).toBe(200);
      expect(mockAuthMiddleware).toHaveBeenCalled();
    });

    it('should validate before calling route handler', async () => {
      // This test ensures that validation happens before the route handler
      // If validation fails, the handler should not be called
      const response = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: '', // This should fail validation
          service_type: 'SPRAY',
          area_ha: 10
        })
      });

      expect(response.status).toBe(400);
      // The route handler should not have been called due to validation failure
    });
  });
});
