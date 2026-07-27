-- CreateEnum
CREATE TYPE "TicketTransferStatus" AS ENUM ('PENDING_VERIFICATION', 'PROCESSING', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransferEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "TicketTransfer" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "TicketTransferStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationCodeHash" TEXT NOT NULL,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "verificationResendCount" INTEGER NOT NULL DEFAULT 0,
    "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
    "verificationCodeSentAt" TIMESTAMP(3),
    "verificationLastResentAt" TIMESTAMP(3),
    "verificationVerifiedAt" TIMESTAMP(3),
    "verificationEmailStatus" "TransferEmailStatus" NOT NULL DEFAULT 'PENDING',
    "verificationEmailFailureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "senderEmailStatus" "TransferEmailStatus" NOT NULL DEFAULT 'PENDING',
    "senderEmailSentAt" TIMESTAMP(3),
    "senderEmailFailureReason" TEXT,
    "recipientEmailStatus" "TransferEmailStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmailSentAt" TIMESTAMP(3),
    "recipientEmailFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "previousOwnerId" TEXT,
    "previousHolderName" TEXT NOT NULL,
    "previousHolderEmail" TEXT NOT NULL,
    "previousHolderPhone" TEXT,
    "newOwnerId" TEXT NOT NULL,
    "newHolderName" TEXT NOT NULL,
    "newHolderEmail" TEXT NOT NULL,
    "newHolderPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredAt" TIMESTAMP(3),

    CONSTRAINT "TicketTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketTransfer_reference_key" ON "TicketTransfer"("reference");

-- CreateIndex
CREATE INDEX "TicketTransfer_senderId_idx" ON "TicketTransfer"("senderId");

-- CreateIndex
CREATE INDEX "TicketTransfer_recipientId_idx" ON "TicketTransfer"("recipientId");

-- CreateIndex
CREATE INDEX "TicketTransfer_status_idx" ON "TicketTransfer"("status");

-- CreateIndex
CREATE INDEX "TicketTransfer_verificationExpiresAt_idx" ON "TicketTransfer"("verificationExpiresAt");

-- CreateIndex
CREATE INDEX "TicketTransfer_requestedAt_idx" ON "TicketTransfer"("requestedAt");

-- CreateIndex
CREATE INDEX "TicketTransfer_completedAt_idx" ON "TicketTransfer"("completedAt");

-- CreateIndex
CREATE INDEX "TicketTransfer_senderId_status_idx" ON "TicketTransfer"("senderId", "status");

-- CreateIndex
CREATE INDEX "TicketTransfer_recipientId_status_idx" ON "TicketTransfer"("recipientId", "status");

-- CreateIndex
CREATE INDEX "TicketTransferItem_transferId_idx" ON "TicketTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "TicketTransferItem_ticketId_idx" ON "TicketTransferItem"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTransferItem_previousOwnerId_idx" ON "TicketTransferItem"("previousOwnerId");

-- CreateIndex
CREATE INDEX "TicketTransferItem_newOwnerId_idx" ON "TicketTransferItem"("newOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTransferItem_transferId_ticketId_key" ON "TicketTransferItem"("transferId", "ticketId");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransferItem" ADD CONSTRAINT "TicketTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TicketTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransferItem" ADD CONSTRAINT "TicketTransferItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
