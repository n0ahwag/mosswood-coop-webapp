-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VillagerState" AS ENUM ('IDLE', 'WORKING', 'HUNGRY', 'EATING', 'TIRED', 'RESTING');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShipStatus" AS ENUM ('INCOMING', 'DOCKED', 'COMPLETED', 'DEPARTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "seals" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valleyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valley" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valley_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Village" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inventory" JSONB NOT NULL DEFAULT '{}',
    "storageCap" INTEGER NOT NULL DEFAULT 100,
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loaded" BOOLEAN NOT NULL DEFAULT false,
    "stock" JSONB NOT NULL DEFAULT '{}',
    "villageId" TEXT NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Villager" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "VillagerState" NOT NULL DEFAULT 'IDLE',
    "energy" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "satiety" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "stateTimer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "villageId" TEXT NOT NULL,
    "buildingId" TEXT,

    CONSTRAINT "Villager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValleyProject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "valleyId" TEXT NOT NULL,

    CONSTRAINT "ValleyProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContribution" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ProjectContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeShip" (
    "id" TEXT NOT NULL,
    "status" "ShipStatus" NOT NULL DEFAULT 'INCOMING',
    "demands" JSONB NOT NULL,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "departsAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "valleyId" TEXT NOT NULL,

    CONSTRAINT "TradeShip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipLoad" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ShipLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchUnlock" (
    "id" TEXT NOT NULL,
    "techKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "valleyId" TEXT,

    CONSTRAINT "ResearchUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_sessionTokenHash_key" ON "User"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "User_valleyId_idx" ON "User"("valleyId");

-- CreateIndex
CREATE UNIQUE INDEX "Valley_inviteCode_key" ON "Valley"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Village_ownerId_key" ON "Village"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_villageId_type_key" ON "Building"("villageId", "type");

-- CreateIndex
CREATE INDEX "Villager_villageId_idx" ON "Villager"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "ValleyProject_valleyId_key_key" ON "ValleyProject"("valleyId", "key");

-- CreateIndex
CREATE INDEX "ProjectContribution_projectId_idx" ON "ProjectContribution"("projectId");

-- CreateIndex
CREATE INDEX "ProjectContribution_userId_idx" ON "ProjectContribution"("userId");

-- CreateIndex
CREATE INDEX "TradeShip_valleyId_arrivesAt_idx" ON "TradeShip"("valleyId", "arrivesAt");

-- CreateIndex
CREATE INDEX "ShipLoad_shipId_idx" ON "ShipLoad"("shipId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchUnlock_userId_techKey_key" ON "ResearchUnlock"("userId", "techKey");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchUnlock_valleyId_techKey_key" ON "ResearchUnlock"("valleyId", "techKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_valleyId_fkey" FOREIGN KEY ("valleyId") REFERENCES "Valley"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Village" ADD CONSTRAINT "Village_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Villager" ADD CONSTRAINT "Villager_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Village"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Villager" ADD CONSTRAINT "Villager_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValleyProject" ADD CONSTRAINT "ValleyProject_valleyId_fkey" FOREIGN KEY ("valleyId") REFERENCES "Valley"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContribution" ADD CONSTRAINT "ProjectContribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ValleyProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContribution" ADD CONSTRAINT "ProjectContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeShip" ADD CONSTRAINT "TradeShip_valleyId_fkey" FOREIGN KEY ("valleyId") REFERENCES "Valley"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipLoad" ADD CONSTRAINT "ShipLoad_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "TradeShip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipLoad" ADD CONSTRAINT "ShipLoad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchUnlock" ADD CONSTRAINT "ResearchUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchUnlock" ADD CONSTRAINT "ResearchUnlock_valleyId_fkey" FOREIGN KEY ("valleyId") REFERENCES "Valley"("id") ON DELETE CASCADE ON UPDATE CASCADE;

