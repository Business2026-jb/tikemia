-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'SUSPENDED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "OrganizerActivityType" AS ENUM ('EVENT_CREATED', 'EVENT_PUBLISHED', 'ORDER_PAID', 'TICKET_SOLD', 'PAYMENT_RECEIVED', 'PAYOUT_REQUESTED', 'PAYOUT_PAID', 'REFUND_COMPLETED');

-- CreateTable
CREATE TABLE "EventCategory" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"description" TEXT,
"icon" TEXT,
"isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Event" (
"id" TEXT NOT NULL,
"organizerId" TEXT NOT NULL,
"categoryId" TEXT,
"title" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"description" TEXT NOT NULL,
"coverImage" TEXT,
"venueName" TEXT NOT NULL,
"address" TEXT NOT NULL,
"city" TEXT NOT NULL,
"country" TEXT NOT NULL,
"countryCode" TEXT NOT NULL,
"timezone" TEXT NOT NULL,
"startsAt" TIMESTAMP(3) NOT NULL,
"endsAt" TIMESTAMP(3),
"salesStartAt" TIMESTAMP(3),
"salesEndAt" TIMESTAMP(3),
"currency" TEXT NOT NULL DEFAULT 'XOF',
"platformFeeRate" DECIMAL(5,2) NOT NULL DEFAULT 6.00,
"capacity" INTEGER NOT NULL DEFAULT 0,
"status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
"publishedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Event_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "TicketType" (
"id" TEXT NOT NULL,
"eventId" TEXT NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT,
"price" DECIMAL(18,2) NOT NULL,
"quantity" INTEGER NOT NULL,
"maxPerOrder" INTEGER NOT NULL DEFAULT 10,
"saleStartsAt" TIMESTAMP(3),
"saleEndsAt" TIMESTAMP(3),
"isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Order" (
"id" TEXT NOT NULL,
"reference" TEXT NOT NULL,
"eventId" TEXT NOT NULL,
"customerId" TEXT,
"customerName" TEXT NOT NULL,
"customerEmail" TEXT NOT NULL,
"customerPhone" TEXT NOT NULL,
"currency" TEXT NOT NULL,
"subtotal" DECIMAL(18,2) NOT NULL,
"platformFee" DECIMAL(18,2) NOT NULL,
"total" DECIMAL(18,2) NOT NULL,
"status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
"paidAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Order_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "OrderItem" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"ticketTypeId" TEXT NOT NULL,
"quantity" INTEGER NOT NULL,
"unitPrice" DECIMAL(18,2) NOT NULL,
"subtotal" DECIMAL(18,2) NOT NULL,
"platformFee" DECIMAL(18,2) NOT NULL,
"total" DECIMAL(18,2) NOT NULL,

CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Payment" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"provider" TEXT NOT NULL,
"providerReference" TEXT,
"method" TEXT NOT NULL,
"amount" DECIMAL(18,2) NOT NULL,
"currency" TEXT NOT NULL,
"status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
"failureReason" TEXT,
"metadata" JSONB,
"paidAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Ticket" (
"id" TEXT NOT NULL,
"code" TEXT NOT NULL,
"qrCodeValue" TEXT NOT NULL,
"eventId" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"orderItemId" TEXT NOT NULL,
"ticketTypeId" TEXT NOT NULL,
"holderName" TEXT NOT NULL,
"holderEmail" TEXT NOT NULL,
"holderPhone" TEXT,
"status" "TicketStatus" NOT NULL DEFAULT 'VALID',
"usedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Payout" (
"id" TEXT NOT NULL,
"organizerId" TEXT NOT NULL,
"amount" DECIMAL(18,2) NOT NULL,
"fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
"netAmount" DECIMAL(18,2) NOT NULL,
"currency" TEXT NOT NULL,
"status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
"reference" TEXT,
"note" TEXT,
"requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"processedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "Coupon" (
"id" TEXT NOT NULL,
"eventId" TEXT NOT NULL,
"code" TEXT NOT NULL,
"type" "CouponType" NOT NULL,
"value" DECIMAL(18,2) NOT NULL,
"usageLimit" INTEGER,
"usedCount" INTEGER NOT NULL DEFAULT 0,
"startsAt" TIMESTAMP(3),
"endsAt" TIMESTAMP(3),
"isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")

);

-- CreateTable
CREATE TABLE "OrganizerActivity" (
"id" TEXT NOT NULL,
"organizerId" TEXT NOT NULL,
"eventId" TEXT,
"type" "OrganizerActivityType" NOT NULL,
"title" TEXT NOT NULL,
"description" TEXT,
"amount" DECIMAL(18,2),
"currency" TEXT,
"metadata" JSONB,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "OrganizerActivity_pkey" PRIMARY KEY ("id")

);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- CreateIndex
CREATE INDEX "EventCategory_isActive_idx" ON "EventCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_organizerId_status_idx" ON "Event"("organizerId", "status");

-- CreateIndex
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");

-- CreateIndex
CREATE INDEX "TicketType_isActive_idx" ON "TicketType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE INDEX "Order_eventId_idx" ON "Order"("eventId");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "Order_eventId_status_idx" ON "Order"("eventId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_ticketTypeId_idx" ON "OrderItem"("ticketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrCodeValue_key" ON "Ticket"("qrCodeValue");

-- CreateIndex
CREATE INDEX "Ticket_eventId_idx" ON "Ticket"("eventId");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- CreateIndex
CREATE INDEX "Ticket_ticketTypeId_idx" ON "Ticket"("ticketTypeId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");

-- CreateIndex
CREATE INDEX "Payout_organizerId_idx" ON "Payout"("organizerId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_requestedAt_idx" ON "Payout"("requestedAt");

-- CreateIndex
CREATE INDEX "Coupon_eventId_idx" ON "Coupon"("eventId");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_eventId_code_key" ON "Coupon"("eventId", "code");

-- CreateIndex
CREATE INDEX "OrganizerActivity_organizerId_idx" ON "OrganizerActivity"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerActivity_eventId_idx" ON "OrganizerActivity"("eventId");

-- CreateIndex
CREATE INDEX "OrganizerActivity_type_idx" ON "OrganizerActivity"("type");

-- CreateIndex
CREATE INDEX "OrganizerActivity_createdAt_idx" ON "OrganizerActivity"("createdAt");

-- CreateIndex
CREATE INDEX "EmailVerification_status_idx" ON "EmailVerification"("status");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerActivity" ADD CONSTRAINT "OrganizerActivity_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerActivity" ADD CONSTRAINT "OrganizerActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;