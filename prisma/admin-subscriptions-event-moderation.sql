-- CreateEnum
CREATE TYPE "SubscriptionBillingPeriod" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventBoostSource" AS ENUM ('SUBSCRIPTION', 'ADMIN', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "EventBoostStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EventModerationAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'SUSPEND', 'RESTORE', 'CANCEL', 'ARCHIVE', 'DELETE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EVENT_STATUS', 'ORDER', 'PAYMENT', 'PAYOUT', 'SUBSCRIPTION', 'MARKETING', 'SECURITY', 'SUPPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('GENERAL', 'EVENT', 'ORDER', 'PAYMENT', 'PAYOUT', 'SUBSCRIPTION', 'ACCOUNT', 'SECURITY', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('EVENT', 'ORGANIZER', 'CUSTOMER', 'ORDER', 'PAYMENT', 'CONTENT');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FRAUD', 'PROHIBITED_CONTENT', 'MISLEADING_INFORMATION', 'COPYRIGHT', 'HARASSMENT', 'PAYMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventStatus" ADD VALUE 'REJECTED';
ALTER TYPE "EventStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_SUBMITTED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_REJECTED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_SUSPENDED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_RESTORED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_CANCELLED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_ARCHIVED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'SUBSCRIPTION_STARTED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'SUBSCRIPTION_RENEWED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_BOOST_STARTED';
ALTER TYPE "OrganizerActivityType" ADD VALUE 'EVENT_BOOST_ENDED';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN     "blueBadgeGrantedAt" TIMESTAMP(3),
ADD COLUMN     "firstSubscribedAt" TIMESTAMP(3),
ADD COLUMN     "hasBlueBadge" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "billingPeriod" "SubscriptionBillingPeriod" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxBoostedEvents" INTEGER NOT NULL DEFAULT 1,
    "priorityScore" INTEGER NOT NULL DEFAULT 100,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerSubscription" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBoost" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "createdByAdminId" TEXT,
    "source" "EventBoostSource" NOT NULL DEFAULT 'SUBSCRIPTION',
    "status" "EventBoostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priorityScore" INTEGER NOT NULL DEFAULT 100,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventModerationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "EventModerationAction" NOT NULL,
    "previousStatus" "EventStatus" NOT NULL,
    "newStatus" "EventStatus" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "subject" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "eventId" TEXT,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isPublic_idx" ON "SubscriptionPlan"("isPublic");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_sortOrder_idx" ON "SubscriptionPlan"("sortOrder");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_organizerId_idx" ON "OrganizerSubscription"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_planId_idx" ON "OrganizerSubscription"("planId");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_status_idx" ON "OrganizerSubscription"("status");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_startsAt_idx" ON "OrganizerSubscription"("startsAt");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_endsAt_idx" ON "OrganizerSubscription"("endsAt");

-- CreateIndex
CREATE INDEX "OrganizerSubscription_organizerId_status_idx" ON "OrganizerSubscription"("organizerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_providerReference_key" ON "SubscriptionPayment"("providerReference");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_organizerId_idx" ON "SubscriptionPayment"("organizerId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_paidAt_idx" ON "SubscriptionPayment"("paidAt");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_organizerId_status_idx" ON "SubscriptionPayment"("organizerId", "status");

-- CreateIndex
CREATE INDEX "EventBoost_organizerId_idx" ON "EventBoost"("organizerId");

-- CreateIndex
CREATE INDEX "EventBoost_eventId_idx" ON "EventBoost"("eventId");

-- CreateIndex
CREATE INDEX "EventBoost_subscriptionId_idx" ON "EventBoost"("subscriptionId");

-- CreateIndex
CREATE INDEX "EventBoost_createdByAdminId_idx" ON "EventBoost"("createdByAdminId");

-- CreateIndex
CREATE INDEX "EventBoost_status_idx" ON "EventBoost"("status");

-- CreateIndex
CREATE INDEX "EventBoost_startsAt_idx" ON "EventBoost"("startsAt");

-- CreateIndex
CREATE INDEX "EventBoost_endsAt_idx" ON "EventBoost"("endsAt");

-- CreateIndex
CREATE INDEX "EventBoost_status_startsAt_endsAt_idx" ON "EventBoost"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "EventBoost_priorityScore_status_idx" ON "EventBoost"("priorityScore", "status");

-- CreateIndex
CREATE INDEX "EventModerationLog_eventId_idx" ON "EventModerationLog"("eventId");

-- CreateIndex
CREATE INDEX "EventModerationLog_adminId_idx" ON "EventModerationLog"("adminId");

-- CreateIndex
CREATE INDEX "EventModerationLog_action_idx" ON "EventModerationLog"("action");

-- CreateIndex
CREATE INDEX "EventModerationLog_createdAt_idx" ON "EventModerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "EventModerationLog_eventId_createdAt_idx" ON "EventModerationLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_type_idx" ON "UserNotification"("type");

-- CreateIndex
CREATE INDEX "UserNotification_status_idx" ON "UserNotification"("status");

-- CreateIndex
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_userId_status_createdAt_idx" ON "UserNotification"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket"("reference");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterId_idx" ON "SupportTicket"("requesterId");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

-- CreateIndex
CREATE INDEX "SupportMessage_authorId_idx" ON "SupportMessage"("authorId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformReport_reporterId_idx" ON "PlatformReport"("reporterId");

-- CreateIndex
CREATE INDEX "PlatformReport_assignedToId_idx" ON "PlatformReport"("assignedToId");

-- CreateIndex
CREATE INDEX "PlatformReport_eventId_idx" ON "PlatformReport"("eventId");

-- CreateIndex
CREATE INDEX "PlatformReport_status_idx" ON "PlatformReport"("status");

-- CreateIndex
CREATE INDEX "PlatformReport_category_idx" ON "PlatformReport"("category");

-- CreateIndex
CREATE INDEX "PlatformReport_targetType_targetId_idx" ON "PlatformReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformReport_createdAt_idx" ON "PlatformReport"("createdAt");

-- CreateIndex
CREATE INDEX "Event_reviewedById_idx" ON "Event"("reviewedById");

-- CreateIndex
CREATE INDEX "Event_submittedAt_idx" ON "Event"("submittedAt");

-- CreateIndex
CREATE INDEX "Event_reviewedAt_idx" ON "Event"("reviewedAt");

-- CreateIndex
CREATE INDEX "Event_publishedAt_idx" ON "Event"("publishedAt");

-- CreateIndex
CREATE INDEX "Event_isFeatured_status_idx" ON "Event"("isFeatured", "status");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerSubscription" ADD CONSTRAINT "OrganizerSubscription_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerSubscription" ADD CONSTRAINT "OrganizerSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizerSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoost" ADD CONSTRAINT "EventBoost_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoost" ADD CONSTRAINT "EventBoost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoost" ADD CONSTRAINT "EventBoost_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizerSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBoost" ADD CONSTRAINT "EventBoost_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventModerationLog" ADD CONSTRAINT "EventModerationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventModerationLog" ADD CONSTRAINT "EventModerationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformReport" ADD CONSTRAINT "PlatformReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformReport" ADD CONSTRAINT "PlatformReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformReport" ADD CONSTRAINT "PlatformReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
