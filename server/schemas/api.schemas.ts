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
    z.number().positive('Prezzo deve essere positivo'),
    z.string().transform((val) => {
      // Handle Italian format: "4.869,57" -> 486957 cents
      const normalized = val.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(normalized);
      if (isNaN(parsed)) throw new Error('Formato prezzo non valido');
      return Math.round(parsed * 100); // Convert euro to cents
    })
  ]).transform((val) => {
    // Ensure result is always an integer (cents)
    return typeof val === 'number' ? Math.round(val) : val;
  }),
  pricing_snapshot_json: z.any().optional(),
  currency: z.string().default('EUR'),
  proposed_start: z.string().optional(),
  proposed_end: z.string().optional(),
  provider_note: z.string().optional()
});

// Organization registration schema
export const RegisterOrganizationSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'Password minimo 8 caratteri'),
  firstName: z.string().min(1, 'Nome obbligatorio'),
  lastName: z.string().min(1, 'Cognome obbligatorio'),
  phone: z.string().optional(),
  organizationName: z.string().min(1, 'Nome organizzazione obbligatorio'),
  accountType: z.enum(['buyer', 'vendor', 'operator'])
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

// Additional schemas for other endpoints

// Auth schemas
export const VerifyEmailSchema = z.object({
  code: z.string().min(1, 'Codice obbligatorio')
});

export const ResendVerificationSchema = z.object({
  email: z.string().email('Email non valida')
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().email('Email non valida')
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obbligatorio'),
  newPassword: z.string().min(8, 'Password minimo 8 caratteri')
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(1, 'Token obbligatorio'),
  password: z.string().min(8, 'Password minimo 8 caratteri'),
  firstName: z.string().min(1, 'Nome obbligatorio'),
  lastName: z.string().min(1, 'Cognome obbligatorio')
});

// Orders schemas
export const CreateOrderFromCartSchema = z.object({
  cartId: z.string().min(1, 'Cart ID obbligatorio'),
  shippingAddress: z.any().optional(),
  billingAddress: z.any().optional(),
  customerNotes: z.string().optional()
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  tracking_number: z.string().optional()
});

// Operators schemas
export const CreateOperatorSchema = z.object({
  first_name: z.string().min(1, 'Nome obbligatorio'),
  last_name: z.string().min(1, 'Cognome obbligatorio'),
  email: z.string().email('Email non valida'),
  service_tags: z.array(z.string()).default(['SPRAY']),
  max_hours_per_day: z.number().positive().optional(),
  max_ha_per_day: z.number().positive().optional(),
  home_location_id: z.string().optional(),
  default_service_area_set_id: z.string().optional()
});

export const UpdateOperatorSchema = z.object({
  service_tags: z.array(z.string()).optional(),
  max_hours_per_day: z.number().positive().optional(),
  max_ha_per_day: z.number().positive().optional(),
  home_location_lat: z.number().optional(),
  home_location_lng: z.number().optional()
});

// Ecommerce schemas
export const AddCartItemSchema = z.object({
  cartId: z.string().min(1, 'Cart ID obbligatorio'),
  skuId: z.string().min(1, 'SKU ID obbligatorio'),
  quantity: z.number().int().positive().default(1)
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  service_config: z.any().optional()
});

export const CreateAddressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING']),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.string().optional(),
  address_line_1: z.string().min(1),
  address_line_2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().default('IT'),
  phone: z.string().optional()
});

export const UpdateAddressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING']).optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  company: z.string().optional(),
  address_line_1: z.string().min(1).optional(),
  address_line_2: z.string().optional(),
  city: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  postal_code: z.string().min(1).optional(),
  country: z.string().optional(),
  phone: z.string().optional()
});

// Settings schemas
export const CreateInvitationSchema = z.object({
  email: z.string().email('Email non valida'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'])
});

export const UpdateOrganizationSchema = z.object({
  legal_name: z.string().min(1).optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  region: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  support_email: z.string().email().optional(),
  show_individual_operators: z.boolean().optional()
});

// Services schemas
export const CreateServiceSchema = z.object({
  service_type: ServiceTypeSchema,
  base_rate_per_ha_cents: z.number().positive(),
  min_charge_cents: z.number().positive().optional(),
  travel_fixed_cents: z.number().nonnegative().optional(),
  travel_rate_per_km_cents: z.number().nonnegative().optional(),
  hilly_terrain_multiplier: z.number().min(1).optional(),
  hilly_terrain_surcharge_cents: z.number().nonnegative().optional(),
  crop_types: z.array(z.string()).optional(),
  is_active: z.boolean().default(true)
});

export const UpdateServiceSchema = z.object({
  base_rate_per_ha_cents: z.number().positive().optional(),
  min_charge_cents: z.number().positive().optional(),
  travel_fixed_cents: z.number().nonnegative().optional(),
  travel_rate_per_km_cents: z.number().nonnegative().optional(),
  hilly_terrain_multiplier: z.number().min(1).optional(),
  hilly_terrain_surcharge_cents: z.number().nonnegative().optional(),
  crop_types: z.array(z.string()).optional(),
  is_active: z.boolean().optional()
});

// Saved Fields schemas
export const CreateSavedFieldSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio'),
  polygon: z.any(), // GeoJSON polygon
  area_ha: z.number().positive(),
  location_json: z.any().optional(),
  crop_type: CropTypeSchema.optional(),
  treatment_type: TreatmentTypeSchema.optional(),
  terrain_conditions: TerrainConditionSchema.optional(),
  notes: z.string().optional()
});

// Messages schemas
export const CreateMessageSchema = z.object({
  content: z.string().min(1, 'Messaggio obbligatorio'),
  message_type: z.enum(['TEXT', 'SYSTEM']).default('TEXT'),
  attachments: z.array(z.any()).optional()
});

export const MarkMessagesReadSchema = z.object({
  message_ids: z.array(z.string()).min(1, 'Almeno un messaggio da marcare')
});

// Routing schemas
export const DirectionsRequestSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  waypoints: z.array(z.object({
    lat: z.number(),
    lng: z.number()
  })).optional()
});

// Type exports
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type CreateJobOfferInput = z.infer<typeof CreateJobOfferSchema>;
export type RegisterOrganizationInput = z.infer<typeof RegisterOrganizationSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CertifiedQuotesRequest = z.infer<typeof CertifiedQuotesRequestSchema>;
export type CreateOrderFromCartInput = z.infer<typeof CreateOrderFromCartSchema>;
export type CreateOperatorInput = z.infer<typeof CreateOperatorSchema>;
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type CreateSavedFieldInput = z.infer<typeof CreateSavedFieldSchema>;
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;
export type DirectionsRequest = z.infer<typeof DirectionsRequestSchema>;
