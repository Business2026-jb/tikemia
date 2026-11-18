-- CreateEnum
CREATE TYPE "PayEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PayMethodType" AS ENUM ('MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "PayConnectionStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'VERIFIED', 'SUSPENDED', 'ERROR');

-- CreateEnum
CREATE TYPE "PayAttemptStatus" AS ENUM ('CREATED', 'ROUTED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PayWebhookStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PayRoutingDecisionStatus" AS ENUM ('SELECTED', 'NO_ROUTE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayMerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayOperationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SECURITY');

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "PayProvider" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayProviderConnection" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "environment" "PayEnvironment" NOT NULL,
    "label" TEXT NOT NULL,
    "credentialsEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "PayConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayMethod" (
    "id" UUID NOT NULL,
    "code" VARCHAR(70) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayMethodType" NOT NULL,
    "logoPath" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayCountry" (
    "code" VARCHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayCountry_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "PayCurrency" (
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "exponent" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayCurrency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "PayProviderCapability" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minAmount" BIGINT,
    "maxAmount" BIGINT,
    "providerMethodCode" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayProviderCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRoutingRule" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minAmount" BIGINT,
    "maxAmount" BIGINT,
    "allowFallback" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRoutingDecision" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "connectionId" UUID,
    "ruleId" UUID,
    "status" "PayRoutingDecisionStatus" NOT NULL,
    "reason" TEXT,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRoutingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPaymentAttempt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "PayAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "failureCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayWebhookReceipt" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "connectionId" UUID,
    "attemptId" UUID,
    "deduplicationKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "eventType" TEXT,
    "payloadHash" TEXT NOT NULL,
    "redactedPayload" JSONB,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" "PayWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "failureCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PayWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayMerchant" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PayMerchantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayMerchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayMerchantApiKey" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayMerchantApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRefundAttempt" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "PayAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PayRefundAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayOperationLog" (
    "id" UUID NOT NULL,
    "providerId" UUID,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "severity" "PayOperationSeverity" NOT NULL DEFAULT 'INFO',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayProvider_code_key" ON "PayProvider"("code");

-- CreateIndex
CREATE INDEX "PayProvider_isEnabled_idx" ON "PayProvider"("isEnabled");

-- CreateIndex
CREATE INDEX "PayProviderConnection_environment_isEnabled_status_idx" ON "PayProviderConnection"("environment", "isEnabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayProviderConnection_providerId_environment_label_key" ON "PayProviderConnection"("providerId", "environment", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PayMethod_code_key" ON "PayMethod"("code");

-- CreateIndex
CREATE INDEX "PayMethod_isEnabled_displayOrder_idx" ON "PayMethod"("isEnabled", "displayOrder");

-- CreateIndex
CREATE INDEX "PayCountry_isEnabled_idx" ON "PayCountry"("isEnabled");

-- CreateIndex
CREATE INDEX "PayCurrency_isEnabled_idx" ON "PayCurrency"("isEnabled");

-- CreateIndex
CREATE INDEX "PayProviderCapability_countryCode_currencyCode_methodId_isE_idx" ON "PayProviderCapability"("countryCode", "currencyCode", "methodId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "PayProviderCapability_connectionId_methodId_countryCode_cur_key" ON "PayProviderCapability"("connectionId", "methodId", "countryCode", "currencyCode");

-- CreateIndex
CREATE INDEX "PayRoutingRule_countryCode_currencyCode_methodId_isEnabled__idx" ON "PayRoutingRule"("countryCode", "currencyCode", "methodId", "isEnabled", "priority");

-- CreateIndex
CREATE INDEX "PayRoutingRule_connectionId_idx" ON "PayRoutingRule"("connectionId");

-- CreateIndex
CREATE INDEX "PayRoutingDecision_paymentId_createdAt_idx" ON "PayRoutingDecision"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PayRoutingDecision_connectionId_createdAt_idx" ON "PayRoutingDecision"("connectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayPaymentAttempt_idempotencyKey_key" ON "PayPaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayPaymentAttempt_paymentId_createdAt_idx" ON "PayPaymentAttempt"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PayPaymentAttempt_status_createdAt_idx" ON "PayPaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayPaymentAttempt_connectionId_providerReference_key" ON "PayPaymentAttempt"("connectionId", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "PayWebhookReceipt_deduplicationKey_key" ON "PayWebhookReceipt"("deduplicationKey");

-- CreateIndex
CREATE INDEX "PayWebhookReceipt_providerId_receivedAt_idx" ON "PayWebhookReceipt"("providerId", "receivedAt");

-- CreateIndex
CREATE INDEX "PayWebhookReceipt_status_receivedAt_idx" ON "PayWebhookReceipt"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "PayWebhookReceipt_attemptId_idx" ON "PayWebhookReceipt"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "PayMerchant_code_key" ON "PayMerchant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayMerchantApiKey_keyPrefix_key" ON "PayMerchantApiKey"("keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "PayMerchantApiKey_keyHash_key" ON "PayMerchantApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "PayMerchantApiKey_merchantId_revokedAt_idx" ON "PayMerchantApiKey"("merchantId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayRefundAttempt_idempotencyKey_key" ON "PayRefundAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayRefundAttempt_refundId_createdAt_idx" ON "PayRefundAttempt"("refundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayRefundAttempt_connectionId_providerReference_key" ON "PayRefundAttempt"("connectionId", "providerReference");

-- CreateIndex
CREATE INDEX "PayOperationLog_providerId_createdAt_idx" ON "PayOperationLog"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "PayOperationLog_entity_entityId_idx" ON "PayOperationLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "PayOperationLog_severity_createdAt_idx" ON "PayOperationLog"("severity", "createdAt");

-- AddForeignKey
ALTER TABLE "PayProviderConnection" ADD CONSTRAINT "PayProviderConnection_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PayProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayProviderCapability" ADD CONSTRAINT "PayProviderCapability_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayProviderCapability" ADD CONSTRAINT "PayProviderCapability_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayProviderCapability" ADD CONSTRAINT "PayProviderCapability_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "PayCountry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayProviderCapability" ADD CONSTRAINT "PayProviderCapability_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "PayCurrency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingRule" ADD CONSTRAINT "PayRoutingRule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingRule" ADD CONSTRAINT "PayRoutingRule_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingRule" ADD CONSTRAINT "PayRoutingRule_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "PayCountry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingRule" ADD CONSTRAINT "PayRoutingRule_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "PayCurrency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "PayCountry"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "PayCurrency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRoutingDecision" ADD CONSTRAINT "PayRoutingDecision_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PayRoutingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPaymentAttempt" ADD CONSTRAINT "PayPaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPaymentAttempt" ADD CONSTRAINT "PayPaymentAttempt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPaymentAttempt" ADD CONSTRAINT "PayPaymentAttempt_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayWebhookReceipt" ADD CONSTRAINT "PayWebhookReceipt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PayProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayWebhookReceipt" ADD CONSTRAINT "PayWebhookReceipt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayWebhookReceipt" ADD CONSTRAINT "PayWebhookReceipt_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PayPaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayMerchantApiKey" ADD CONSTRAINT "PayMerchantApiKey_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "PayMerchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRefundAttempt" ADD CONSTRAINT "PayRefundAttempt_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRefundAttempt" ADD CONSTRAINT "PayRefundAttempt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PayProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayOperationLog" ADD CONSTRAINT "PayOperationLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PayProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
