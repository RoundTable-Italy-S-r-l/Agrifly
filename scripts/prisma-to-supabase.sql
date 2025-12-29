-- Supabase Database Schema (converted from Prisma)
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "VisibilityMode" AS ENUM ('PUBLIC_VERIFIED', 'PRIVATE');

-- Create tables
CREATE TABLE "user" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email_verified" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "organization" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "legal_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "can_buy" BOOLEAN DEFAULT true,
    "can_sell" BOOLEAN DEFAULT false,
    "can_operate" BOOLEAN DEFAULT false,
    "can_dispatch" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "org_membership" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "org_id" UUID NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    "role" "MembershipRole" DEFAULT 'MEMBER',
    "is_active" BOOLEAN DEFAULT true,
    "joined_at" TIMESTAMP DEFAULT NOW(),
    UNIQUE("user_id", "org_id")
);

-- Create indexes
CREATE INDEX "user_email_idx" ON "user"("email");
CREATE INDEX "org_membership_user_id_idx" ON "org_membership"("user_id");
CREATE INDEX "org_membership_org_id_idx" ON "org_membership"("org_id");

-- Enable RLS
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_membership" ENABLE ROW LEVEL SECURITY;

-- Create policies (basic setup - adjust as needed)
CREATE POLICY "Users can read their own data" ON "user"
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON "user"
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Organizations visible to members" ON "organization"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_membership
            WHERE org_membership.org_id = organization.id
            AND org_membership.user_id = auth.uid()
            AND org_membership.is_active = true
        )
    );
