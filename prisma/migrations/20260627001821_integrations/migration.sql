-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "shopDomain" TEXT,
    "shopName" TEXT,
    "externalShopId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" DATETIME,
    "scopes" TEXT,
    "twoWay" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "lastSyncedAt" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "externalId" TEXT,
    "entityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'customer',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Contact" ("address", "createdAt", "email", "id", "name", "notes", "phone", "type", "updatedAt") SELECT "address", "createdAt", "email", "id", "name", "notes", "phone", "type", "updatedAt" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_type_idx" ON "Contact"("type");
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "quantity" REAL NOT NULL DEFAULT 0,
    "avgCost" INTEGER NOT NULL DEFAULT 0,
    "salePrice" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" REAL NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "primaryMediaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_primaryMediaId_fkey" FOREIGN KEY ("primaryMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("avgCost", "category", "createdAt", "id", "name", "notes", "primaryMediaId", "quantity", "reorderThreshold", "salePrice", "sku", "supplierId", "unit", "updatedAt") SELECT "avgCost", "category", "createdAt", "id", "name", "notes", "primaryMediaId", "quantity", "reorderThreshold", "salePrice", "sku", "supplierId", "unit", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE UNIQUE INDEX "Item_primaryMediaId_key" ON "Item"("primaryMediaId");
CREATE INDEX "Item_category_idx" ON "Item"("category");
CREATE INDEX "Item_supplierId_idx" ON "Item"("supplierId");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paymentMethod" TEXT DEFAULT 'cash',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "cogs" INTEGER NOT NULL DEFAULT 0,
    "grossProfit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("cogs", "contactId", "createdAt", "date", "grossProfit", "id", "notes", "paymentMethod", "revenue", "status", "updatedAt") SELECT "cogs", "contactId", "createdAt", "date", "grossProfit", "id", "notes", "paymentMethod", "revenue", "status", "updatedAt" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_date_idx" ON "Sale"("date");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_contactId_idx" ON "Sale"("contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_provider_key" ON "IntegrationConnection"("provider");

-- CreateIndex
CREATE INDEX "ExternalLink_entityType_entityId_idx" ON "ExternalLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLink_provider_entityType_externalId_key" ON "ExternalLink"("provider", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "SyncLog_provider_idx" ON "SyncLog"("provider");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");
