-- CreateEnum
CREATE TYPE "UserRole" AS ENUM (
  'ORGANIZER',
  'CUSTOMER',
  'ADMIN',
  'SCANNER'
);

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "dialCode" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ORGANIZER',
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessName" TEXT,
  "logo" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),

  CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key"
ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key"
ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerProfile_userId_key"
ON "OrganizerProfile"("userId");

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx"
ON "EmailVerification"("email");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx"
ON "EmailVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key"
ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx"
ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx"
ON "Session"("tokenHash");

-- AddForeignKey
ALTER TABLE "OrganizerProfile"
ADD CONSTRAINT "OrganizerProfile_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification"
ADD CONSTRAINT "EmailVerification_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;