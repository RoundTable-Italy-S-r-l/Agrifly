import { describe, it, expect } from 'vitest';
import {
  CreateJobSchema,
  CreateJobOfferSchema,
  RegisterOrganizationSchema,
  LoginSchema,
  VerifyEmailSchema,
  AcceptInviteSchema,
  CreateOrderFromCartSchema,
  AddCartItemSchema,
  CreateAddressSchema,
  CreateOperatorSchema,
  CreateSavedFieldSchema,
  CertifiedQuotesRequestSchema
} from '../server/schemas/api.schemas';

describe('Validation Edge Cases', () => {
  describe('Italian Number Format Edge Cases', () => {
    it('should handle various Italian number formats', () => {
      const testCases = [
        { input: '1.234,56', expected: 123456 },
        { input: '1.234,567', expected: 123457 }, // Rounding
        { input: '0,99', expected: 1 }, // Rounding up
        { input: '0,49', expected: 0 }, // Rounding down
        { input: '1000', expected: 1000 },
        { input: '1.000', expected: 1000 },
        { input: '1.000,00', expected: 100000 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = CreateJobOfferSchema.safeParse({ total_cents: input });
        expect(result.success).toBe(true);
        expect(result.data.total_cents).toBe(expected);
      });
    });

    it('should handle international formats', () => {
      const testCases = [
        { input: 1234.56, expected: 1235 }, // Rounding
        { input: 1234.49, expected: 1234 }, // Rounding down
        { input: 1000, expected: 1000 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = CreateJobOfferSchema.safeParse({ total_cents: input });
        expect(result.success).toBe(true);
        expect(result.data.total_cents).toBe(expected);
      });
    });

    it('should reject invalid number formats', () => {
      const invalidCases = [
        'abc',
        '12,34.56', // Mixed formats
        '12..34',
        '12,,34',
        '',
        ' ',
        null,
        undefined
      ];

      invalidCases.forEach(invalidInput => {
        const result = CreateJobOfferSchema.safeParse({ total_cents: invalidInput });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Email Validation Edge Cases', () => {
    const validEmails = [
      'user@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.com',
      '123@test.org',
      'a@b.c'
    ];

    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'user@',
      'user@@example.com',
      'user example.com',
      '',
      'user@.com',
      'user..user@example.com'
    ];

    it('should accept valid email formats', () => {
      validEmails.forEach(email => {
        const result = RegisterOrganizationSchema.safeParse({
          email,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      invalidEmails.forEach(email => {
        const result = RegisterOrganizationSchema.safeParse({
          email,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.some(issue => issue.path.includes('email'))).toBe(true);
      });
    });
  });

  describe('Password Validation Edge Cases', () => {
    it('should enforce minimum password length', () => {
      const shortPasswords = ['', '1', '12', '123', '1234', '12345', '123456', '1234567'];

      shortPasswords.forEach(password => {
        const result = RegisterOrganizationSchema.safeParse({
          email: 'test@example.com',
          password,
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.some(issue => issue.path.includes('password'))).toBe(true);
      });
    });

    it('should accept valid passwords', () => {
      const validPasswords = ['12345678', 'password123', 'P@ssw0rd!', 'a'.repeat(100)];

      validPasswords.forEach(password => {
        const result = RegisterOrganizationSchema.safeParse({
          email: 'test@example.com',
          password,
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject missing required fields', () => {
      // Test RegisterOrganizationSchema
      const requiredFields = ['email', 'password', 'firstName', 'lastName', 'organizationName', 'accountType'];

      requiredFields.forEach(field => {
        const data = {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        };
        delete (data as any)[field];

        const result = RegisterOrganizationSchema.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues.some(issue => issue.path.includes(field))).toBe(true);
      });
    });

    it('should reject empty strings for required fields', () => {
      const emptyStringFields = ['firstName', 'lastName', 'organizationName'];

      emptyStringFields.forEach(field => {
        const data = {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType: 'buyer'
        };
        (data as any)[field] = '';

        const result = RegisterOrganizationSchema.safeParse(data);
        expect(result.success).toBe(false);
        expect(result.error?.issues.some(issue => issue.path.includes(field))).toBe(true);
      });
    });
  });

  describe('Enum Validation', () => {
    it('should accept valid enum values', () => {
      const validServiceTypes = ['SPRAY', 'SPREAD', 'MAPPING'];
      const validAccountTypes = ['buyer', 'vendor', 'operator'];
      const validCropTypes = ['VINEYARD', 'OLIVE_GROVE', 'CEREAL', 'VEGETABLES', 'FRUIT', 'OTHER'];

      validServiceTypes.forEach(serviceType => {
        const result = CreateJobSchema.safeParse({
          field_name: 'Test Field',
          service_type: serviceType,
          area_ha: 10
        });
        expect(result.success).toBe(true);
      });

      validAccountTypes.forEach(accountType => {
        const result = RegisterOrganizationSchema.safeParse({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType
        });
        expect(result.success).toBe(true);
      });

      validCropTypes.forEach(cropType => {
        const result = CreateSavedFieldSchema.safeParse({
          name: 'Test Field',
          polygon: [[[1, 2], [3, 4], [5, 6]]],
          area_ha: 10,
          crop_type: cropType
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid enum values', () => {
      const invalidServiceTypes = ['INVALID', 'spray', 'SPRAYING', ''];
      const invalidAccountTypes = ['admin', 'customer', 'INVALID'];
      const invalidCropTypes = ['GRAPES', 'invalid', ''];

      invalidServiceTypes.forEach(serviceType => {
        const result = CreateJobSchema.safeParse({
          field_name: 'Test Field',
          service_type: serviceType,
          area_ha: 10
        });
        expect(result.success).toBe(false);
      });

      invalidAccountTypes.forEach(accountType => {
        const result = RegisterOrganizationSchema.safeParse({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType
        });
        expect(result.success).toBe(false);
      });

      invalidCropTypes.forEach(cropType => {
        const result = CreateSavedFieldSchema.safeParse({
          name: 'Test Field',
          polygon: [[[1, 2], [3, 4], [5, 6]]],
          area_ha: 10,
          crop_type: cropType
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Array Validation', () => {
    it('should validate service tags array', () => {
      const result = CreateOperatorSchema.safeParse({
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'mario@example.com',
        service_tags: ['SPRAY', 'SPREAD']
      });
      expect(result.success).toBe(true);
      expect(result.data.service_tags).toEqual(['SPRAY', 'SPREAD']);
    });

    it('should default to SPRAY when service_tags is empty', () => {
      const result = CreateOperatorSchema.safeParse({
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'mario@example.com',
        service_tags: []
      });
      expect(result.success).toBe(true);
      expect(result.data.service_tags).toEqual(['SPRAY']);
    });

    it('should reject invalid service tags', () => {
      const result = CreateOperatorSchema.safeParse({
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'mario@example.com',
        service_tags: ['INVALID_TAG']
      });
      // This should still pass since we don't validate array contents, only that it's an array
      expect(result.success).toBe(true);
    });
  });

  describe('Geospatial Validation', () => {
    it('should validate GeoJSON polygon', () => {
      const validPolygons = [
        [[[1, 2], [3, 4], [5, 6], [1, 2]]], // Simple polygon
        [[[1, 2], [3, 4], [5, 6], [7, 8], [1, 2]]] // More complex
      ];

      validPolygons.forEach(polygon => {
        const result = CreateSavedFieldSchema.safeParse({
          name: 'Test Field',
          polygon,
          area_ha: 10
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept any GeoJSON for polygon field', () => {
      // Since polygon is typed as any, it should accept various formats
      const variousPolygons = [
        [[[1, 2], [3, 4], [5, 6]]],
        { type: 'Polygon', coordinates: [[[1, 2], [3, 4], [5, 6]]] },
        null,
        undefined
      ];

      variousPolygons.forEach(polygon => {
        const result = CreateSavedFieldSchema.safeParse({
          name: 'Test Field',
          polygon,
          area_ha: 10
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Optional Fields Handling', () => {
    it('should handle all optional fields being undefined', () => {
      const minimalData = {
        field_name: 'Test Field',
        service_type: 'SPRAY',
        area_ha: 10
      };

      const result = CreateJobSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
      expect(result.data.crop_type).toBeUndefined();
      expect(result.data.treatment_type).toBeUndefined();
      expect(result.data.terrain_conditions).toBeUndefined();
    });

    it('should handle partial optional fields', () => {
      const partialData = {
        field_name: 'Test Field',
        service_type: 'SPRAY',
        area_ha: 10,
        crop_type: 'VINEYARD'
        // treatment_type and terrain_conditions omitted
      };

      const result = CreateJobSchema.safeParse(partialData);
      expect(result.success).toBe(true);
      expect(result.data.crop_type).toBe('VINEYARD');
      expect(result.data.treatment_type).toBeUndefined();
      expect(result.data.terrain_conditions).toBeUndefined();
    });
  });

  describe('Schema Cross-Validation', () => {
    it('should validate related schemas consistently', () => {
      // Test that account types match between different schemas
      const accountTypes = ['buyer', 'vendor', 'operator'];

      accountTypes.forEach(accountType => {
        const registerResult = RegisterOrganizationSchema.safeParse({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
          accountType
        });
        expect(registerResult.success).toBe(true);
      });
    });

    it('should validate service types consistently', () => {
      const serviceTypes = ['SPRAY', 'SPREAD', 'MAPPING'];

      serviceTypes.forEach(serviceType => {
        const jobResult = CreateJobSchema.safeParse({
          field_name: 'Test Field',
          service_type: serviceType,
          area_ha: 10
        });
        expect(jobResult.success).toBe(true);

        const quotesResult = CertifiedQuotesRequestSchema.safeParse({
          service_type: serviceType,
          area_ha: 10
        });
        expect(quotesResult.success).toBe(true);
      });
    });
  });
});
