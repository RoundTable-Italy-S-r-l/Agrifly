import { describe, it, expect } from "vitest";
import {
  CreateJobSchema,
  CreateJobOfferSchema,
  CertifiedQuotesRequestSchema,
  RegisterOrganizationSchema,
  LoginSchema,
  VerifyEmailSchema,
  AcceptInviteSchema,
  CreateOrderFromCartSchema,
  AddCartItemSchema,
  CreateAddressSchema,
  CreateOperatorSchema,
  CreateSavedFieldSchema,
} from "../server/schemas/api.schemas";

describe("API Validation Schemas", () => {
  describe("CreateJobSchema", () => {
    it("should validate correct job data", () => {
      const validData = {
        field_name: "Campo Test",
        service_type: "SPRAY",
        area_ha: 10.5,
        crop_type: "VINEYARD",
        treatment_type: "FUNGICIDE",
        terrain_conditions: "HILLY",
      };

      const result = CreateJobSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it("should reject invalid job data", () => {
      const invalidData = {
        field_name: "", // empty
        service_type: "INVALID",
        area_ha: -5, // negative
      };

      const result = CreateJobSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      expect(result.error?.issues.length).toBeGreaterThan(0);
    });
  });

  describe("CreateJobOfferSchema", () => {
    it("should validate Italian number format", () => {
      const italianFormat = {
        total_cents: "4869,57", // Italian format with comma
      };

      const result = CreateJobOfferSchema.safeParse(italianFormat);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(486957); // Should be converted to cents
    });

    it("should validate international decimal format", () => {
      const internationalFormat = {
        total_cents: 48.7, // 48.70€ in international format
      };

      const result = CreateJobOfferSchema.safeParse(internationalFormat);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(49); // Rounded to cents
    });

    it("should validate number as cents directly", () => {
      const directCents = {
        total_cents: 486957,
      };

      const result = CreateJobOfferSchema.safeParse(directCents);
      expect(result.success).toBe(true);
      expect(result.data.total_cents).toBe(486957);
    });
  });

  describe("CertifiedQuotesRequestSchema", () => {
    it("should validate and transform Italian area format", () => {
      const italianArea = {
        service_type: "SPRAY",
        area_ha: "10,5", // Italian decimal
      };

      const result = CertifiedQuotesRequestSchema.safeParse(italianArea);
      expect(result.success).toBe(true);
      expect(result.data.area_ha).toBe(10.5);
    });
  });

  describe("RegisterOrganizationSchema", () => {
    it("should validate complete organization data", () => {
      const validData = {
        email: "mario.rossi@example.com",
        password: "password123",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+391234567890",
        organizationName: "Azienda Agricola Rossi",
        accountType: "buyer",
      };

      const result = RegisterOrganizationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "invalid-email",
        password: "password123",
        firstName: "Mario",
        lastName: "Rossi",
        organizationName: "Azienda Agricola Rossi",
        accountType: "buyer",
      };

      const result = RegisterOrganizationSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("LoginSchema", () => {
    it("should validate login credentials", () => {
      const validData = {
        email: "user@example.com",
        password: "password123",
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("VerifyEmailSchema", () => {
    it("should validate verification code", () => {
      const validData = {
        code: "123456",
      };

      const result = VerifyEmailSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("AcceptInviteSchema", () => {
    it("should validate invite acceptance", () => {
      const validData = {
        token: "invite-token-123",
        password: "newpassword123",
        firstName: "Mario",
        lastName: "Rossi",
      };

      const result = AcceptInviteSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("CreateOrderFromCartSchema", () => {
    it("should validate order creation", () => {
      const validData = {
        cartId: "cart-123",
        shippingAddress: { street: "Via Roma 1" },
        billingAddress: { street: "Via Roma 1" },
        customerNotes: "Consegna urgente",
      };

      const result = CreateOrderFromCartSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("AddCartItemSchema", () => {
    it("should validate cart item addition", () => {
      const validData = {
        cartId: "cart-123",
        skuId: "sku-456",
        quantity: 2,
      };

      const result = AddCartItemSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("CreateAddressSchema", () => {
    it("should validate address creation", () => {
      const validData = {
        type: "SHIPPING",
        first_name: "Mario",
        last_name: "Rossi",
        address_line_1: "Via Roma 1",
        city: "Roma",
        province: "RM",
        postal_code: "00100",
        country: "IT",
      };

      const result = CreateAddressSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("CreateOperatorSchema", () => {
    it("should validate operator creation", () => {
      const validData = {
        first_name: "Luca",
        last_name: "Verdi",
        email: "luca.verdi@example.com",
        service_tags: ["SPRAY", "SPREAD"],
        max_hours_per_day: 8,
        max_ha_per_day: 50,
      };

      const result = CreateOperatorSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("CreateSavedFieldSchema", () => {
    it("should validate saved field creation", () => {
      const validData = {
        name: "Campo Nord",
        polygon: [
          [
            [1, 2],
            [3, 4],
            [5, 6],
          ],
        ],
        area_ha: 25.5,
        location_json: { lat: 45.5, lng: 10.5 },
        crop_type: "VINEYARD",
        treatment_type: "FUNGICIDE",
        terrain_conditions: "HILLY",
        notes: "Campo con buona esposizione",
      };

      const result = CreateSavedFieldSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
