// Tipi essenziali per il database (sostituiscono Prisma)
export type UserStatus = 'ACTIVE' | 'BLOCKED';
export type UserRole = 'admin' | 'vendor' | 'operator' | 'dispatcher';
export type OrgStatus = 'ACTIVE' | 'SUSPENDED';
export type OrgType = 'buyer' | 'vendor';
export type ProductType = 'DRONE' | 'BATTERY' | 'SPARE' | 'SERVICE_PACKAGE';
export type ProductStatus = 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'PAID' | 'SHIPPED' | 'FULFILLED' | 'CANCELLED' | 'PROBLEMATIC';
export type VerificationPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

// Interfacce per i risultati delle query
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password_hash?: string;
  password_salt?: string;
  email_verified: boolean;
  status: UserStatus;
}

export interface Organization {
  id: string;
  legal_name: string;
  org_type: OrgType;
  status: OrgStatus;
}

export interface OrgMembership {
  org_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
}
