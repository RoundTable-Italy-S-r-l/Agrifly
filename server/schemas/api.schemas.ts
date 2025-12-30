import { z } from 'zod';

// Custom transforms for Italian number format
const italianNumberTransform = z
  .union([z.string(), z.number()])
  .transform((val) => {
    if (typeof val === 'number') return val;
    // Convert Italian format (1.234,56) to international (1234.56)
    const normalized = val.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
  });

// Enums
export const ServiceTypeSchema = z.enum(['SPRAY', 'SPREAD', 'MAPPING']);
export const CropTypeSchema = z.enum(['VINEYARD', 'OLIVE_GROVE', 'CEREAL', 'VEGETABLES', 'FRUIT', 'OTHER']);
export const TreatmentTypeSchema = z.enum([
  'FUNGICIDE', 'INSECTICIDE', 'HERBICIDE', 'FERTILIZER',
  'ORGANIC_FERTILIZER', 'CHEMICAL_FERTILIZER', 'LIME'
]);
export const TerrainConditionSchema = z.enum(['FLAT', 'HILLY', 'MOUNTAINOUS']);

// Job creation schema
export const CreateJobSchema = z.object({
  field_name: z.string().min(1, 'Nome campo obbligatorio'),
  service_type: ServiceTypeSchema,
  area_ha: z.number().positive('Area deve essere positiva'),
  location_json: z.any().optional(),
  field_polygon: z.any().optional(),
  target_date_start: z.string().optional(),
  target_date_end: z.string().optional(),
  notes: z.string().optional(),
  crop_type: CropTypeSchema.optional(),
  treatment_type: TreatmentTypeSchema.optional(),
  terrain_conditions: TerrainConditionSchema.optional()
});

// Job offer creation schema
export const CreateJobOfferSchema = z.object({
  total_cents: z.union([
    z.number().int().positive('Prezzo deve essere positivo'),
    z.string().transform((val) => {
      // Handle Italian format: "4.869,57" -> 486957
      const normalized = val.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (isNaN(parsed)) throw new Error('Formato prezzo non valido');
      return Math.round(parsed * 100); // Convert to cents
    })
  ]),
  pricing_snapshot_json: z.any().optional(),
  currency: z.string().default('EUR'),
  proposed_start: z.string().optional(),
  proposed_end: z.string().optional(),
  provider_note: z.string().optional()
});

// Organization registration schema
export const RegisterOrganizationSchema = z.object({
  firstName: z.string().min(1, 'Nome obbligatorio'),
  lastName: z.string().min(1, 'Cognome obbligatorio'),
  email: z.string().email('Email non valida'),
  phone: z.string().optional(),
  organizationName: z.string().min(1, 'Nome organizzazione obbligatorio'),
  orgType: z.enum(['FARM', 'AGRICULTURAL_COOP', 'SERVICE_PROVIDER', 'OTHER']),
  password: z.string().min(8, 'Password minimo 8 caratteri')
});

// User login schema
export const LoginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria')
});

// Certified quotes request schema
export const CertifiedQuotesRequestSchema = z.object({
  service_type: ServiceTypeSchema.optional(),
  area_ha: italianNumberTransform,
  location_lat: italianNumberTransform.optional(),
  location_lng: italianNumberTransform.optional(),
  terrain_conditions: TerrainConditionSchema.optional(),
  crop_type: CropTypeSchema.optional(),
  treatment_type: TreatmentTypeSchema.optional(),
  month: z.number().min(1).max(12).optional()
});

// Type exports
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type CreateJobOfferInput = z.infer<typeof CreateJobOfferSchema>;
export type RegisterOrganizationInput = z.infer<typeof RegisterOrganizationSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CertifiedQuotesRequest = z.infer<typeof CertifiedQuotesRequestSchema>;
