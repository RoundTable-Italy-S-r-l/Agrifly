import { describe, it, expect } from 'vitest';
import {
  CreateJobSchema,
  CreateJobOfferSchema,
  CertifiedQuotesRequestSchema,
  RegisterOrganizationSchema
} from '../server/schemas/api.schemas';

describe('API Validation Schemas', () => {
  describe('CreateJobSchema', () => {
    it('should validate correct job data', () => {
      const validData = {
        field_name: 'Campo Test',
        service_type: 'SPRAY',
        area_ha: 10.5,
        crop_type: 'VINEYARD',
        treatment_type: 'FUNGICIDE',
        terrain_conditions: 'HILLY'
      };

      const result = CreateJobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid job data', () => {
      const invalidData = {
        field_name: '', // empty
        service_type: 'INVALID',
        area_ha: -5 // negative
      };

      const result = CreateJobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues.length).toBeGreaterThan(0);
    });
  });

  describe('CreateJobOfferSchema', () => {
    it('should validate Italian number format', () => {
      const italianFormat = {
        total_cents: '4869,57' // Italian format with comma
      };

      const result = CreateJobOfferSchema.safeParse(italianFormat);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(486957); // Should be converted to cents
    });

    it('should validate international number format', () => {
      const internationalFormat = {
        total_cents: 4869.57
      };

      const result = CreateJobOfferSchema.safeParse(internationalFormat);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(4869.57);
    });

    it('should validate number as cents directly', () => {
      const directCents = {
        total_cents: 486957
      };

      const result = CreateJobOfferSchema.safeParse(directCents);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(486957);
    });
  });

  describe('CertifiedQuotesRequestSchema', () => {
    it('should validate and transform Italian area format', () => {
      const italianArea = {
        service_type: 'SPRAY',
        area_ha: '10,5' // Italian decimal
      };

      const result = CertifiedQuotesRequestSchema.safeParse(italianArea);
      expect(result.success).toBe(true);
      expect(result.data.area_ha).toBe(10.5);
    });
  });

  describe('RegisterOrganizationSchema', () => {
    it('should validate complete organization data', () => {
      const validData = {
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario.rossi@example.com',
        phone: '+391234567890',
        organizationName: 'Azienda Agricola Rossi',
        orgType: 'FARM',
        password: 'password123'
      };

      const result = RegisterOrganizationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'invalid-email',
        organizationName: 'Azienda Agricola Rossi',
        orgType: 'FARM',
        password: 'password123'
      };

      const result = RegisterOrganizationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
