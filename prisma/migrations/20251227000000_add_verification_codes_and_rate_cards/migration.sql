-- CreateEnum for VerificationPurpose if not exists
DO $$ BEGIN
 CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum for ServiceType if not exists
DO $$ BEGIN
 CREATE TYPE "ServiceType" AS ENUM ('SPRAY', 'SPREAD', 'MAPPING');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable verification_codes
CREATE TABLE IF NOT EXISTS "verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable rate_cards
CREATE TABLE IF NOT EXISTS "rate_cards" (
    "id" TEXT NOT NULL,
    "seller_org_id" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "base_rate_per_ha_cents" INTEGER NOT NULL,
    "min_charge_cents" INTEGER NOT NULL,
    "travel_rate_per_km_cents" INTEGER NOT NULL,
    "hourly_operator_rate_cents" INTEGER,
    "seasonal_multipliers_json" JSONB,
    "risk_multipliers_json" JSONB,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verification_codes_email_code_used_idx" ON "verification_codes"("email", "code", "used");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "rate_cards_seller_org_id_service_type_key" ON "rate_cards"("seller_org_id", "service_type");

-- AddForeignKey for verification_codes
DO $$ BEGIN
 ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey"
 FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey for rate_cards
DO $$ BEGIN
 ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_seller_org_id_fkey"
 FOREIGN KEY ("seller_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
