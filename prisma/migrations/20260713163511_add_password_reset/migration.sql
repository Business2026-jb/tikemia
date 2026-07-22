-- CreateEnum
CREATE TYPE "PasswordResetStatus" AS ENUM (
  'PENDING',
  'USED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "PasswordReset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" "PasswordResetStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),

  CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordReset_email_idx"
ON "PasswordReset"("email");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx"
ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_status_idx"
ON "PasswordReset"("status");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx"
ON "PasswordReset"("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordReset"
ADD CONSTRAINT "PasswordReset_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;