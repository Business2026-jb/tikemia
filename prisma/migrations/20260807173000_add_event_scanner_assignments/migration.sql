CREATE TABLE "EventScanner" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "scannerId" TEXT NOT NULL,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gateName" TEXT,
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventScanner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventScanner_eventId_scannerId_key"
ON "EventScanner"("eventId", "scannerId");

CREATE INDEX "EventScanner_eventId_idx"
ON "EventScanner"("eventId");

CREATE INDEX "EventScanner_scannerId_idx"
ON "EventScanner"("scannerId");

CREATE INDEX "EventScanner_createdById_idx"
ON "EventScanner"("createdById");

CREATE INDEX "EventScanner_isActive_idx"
ON "EventScanner"("isActive");

CREATE INDEX "EventScanner_eventId_isActive_idx"
ON "EventScanner"("eventId", "isActive");

CREATE INDEX "EventScanner_scannerId_isActive_idx"
ON "EventScanner"("scannerId", "isActive");

ALTER TABLE "EventScanner"
ADD CONSTRAINT "EventScanner_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "EventScanner"
ADD CONSTRAINT "EventScanner_scannerId_fkey"
FOREIGN KEY ("scannerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "EventScanner"
ADD CONSTRAINT "EventScanner_createdById_fkey"
FOREIGN KEY ("createdById")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;