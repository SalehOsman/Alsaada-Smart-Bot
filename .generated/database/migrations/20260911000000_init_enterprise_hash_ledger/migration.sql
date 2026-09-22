-- ==============================================================================
-- Migration: 20260911000000_init_enterprise_hash_ledger
-- Baseline Enterprise Relational Architecture with Cryptographic Hash-Chain Ledger
-- ==============================================================================

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "taxRegistrationNumber" TEXT,
    "commercialRegistrationNumber" TEXT,
    "headquartersAddress" TEXT,
    "primaryPhone" TEXT,
    "officialEmail" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'EGP',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "estimatedBudget" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "governorateCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofenceRadiusMeters" INTEGER DEFAULT 1000,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "telegramGroupId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_accommodations" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'WORKER_BARRACKS',
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "supervisorName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_accommodation_assignments" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "bedNumber" TEXT,
    "checkInDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "site_accommodation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileUri" TEXT NOT NULL,
    "sha256Checksum" TEXT,
    "fileSizeBytes" BIGINT,
    "alertDaysBeforeExpiry" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 99,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_titles" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additionalSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseWageGuideline" DECIMAL(12,2),
    "workDays" INTEGER NOT NULL DEFAULT 20,
    "restDays" INTEGER NOT NULL DEFAULT 10,
    "totalCycleDays" INTEGER NOT NULL DEFAULT 30,
    "shiftNature" TEXT NOT NULL DEFAULT 'دورة قياسية (20+10)',
    "minHeadcount" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 99,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_transition_history" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetCode" TEXT,
    "targetName" TEXT,
    "previousWorkDays" INTEGER NOT NULL,
    "previousRestDays" INTEGER NOT NULL,
    "previousRatio" DECIMAL(6,4) NOT NULL,
    "newWorkDays" INTEGER NOT NULL,
    "newRestDays" INTEGER NOT NULL,
    "newRatio" DECIMAL(6,4) NOT NULL,
    "transitionPolicy" TEXT NOT NULL DEFAULT 'IMMEDIATE_PRORATED',
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByAdminId" BIGINT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_transition_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "code" TEXT NOT NULL,
    "legacyCode" TEXT,
    "aliases" TEXT[],
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "idType" TEXT NOT NULL DEFAULT 'NATIONAL_ID',
    "nationality" TEXT NOT NULL DEFAULT 'مصر',
    "nationalIdEncrypted" TEXT,
    "nationalIdBlindIndex" TEXT,
    "passportNumberEncrypted" TEXT,
    "passportBlindIndex" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "governorateCode" TEXT NOT NULL DEFAULT '88',
    "jobTitle" TEXT NOT NULL,
    "departmentId" TEXT,
    "jobTitleId" TEXT,
    "siteId" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractType" TEXT NOT NULL DEFAULT 'DAILY_LABOR',
    "shiftSystem" TEXT NOT NULL DEFAULT '24_WORK_6_REST',
    "dailyWage" DECIMAL(12,2) NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fixedAllowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_SITE',
    "accountNumberEncrypted" TEXT,
    "walletType" TEXT,
    "canteenCigarettePolicy" TEXT NOT NULL DEFAULT 'NONE',
    "cigaretteBrand" TEXT,
    "canteenItemId" TEXT,
    "walletOwnerName" TEXT,
    "instaPayHandle" TEXT,
    "insuranceNumber" TEXT,
    "insuranceStatus" TEXT,
    "ppeShoeSize" TEXT,
    "ppeUniformSize" TEXT,
    "medicalNotes" TEXT,
    "barracksUnit" TEXT,
    "bedNumber" TEXT,
    "phoneEncrypted" TEXT,
    "phoneBlindIndex" TEXT,
    "emergencyContactName" TEXT,
    "emergencyPhoneEncrypted" TEXT,
    "drivingLicense" TEXT,
    "militaryStatus" TEXT,
    "maritalStatus" TEXT,
    "previousInsuranceStatus" TEXT,
    "idCardFrontPath" TEXT,
    "idCardBackPath" TEXT,
    "idCardExpiryDate" TIMESTAMP(3),
    "idCardExpiryAlertSentAt" TIMESTAMP(3),
    "address" TEXT,
    "telegramId" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "terminationDate" TIMESTAMP(3),
    "terminationReason" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_documents" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileUri" TEXT NOT NULL,
    "driveFileId" TEXT,
    "fileSizeBytes" BIGINT,
    "uploadedBy" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_edit_requests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerCode" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "requesterTelegramId" BIGINT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" BIGINT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_histories" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "previousBasicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousAdditionalSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousGrossSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "newBasicSalary" DECIMAL(12,2) NOT NULL,
    "newAdditionalSalary" DECIMAL(12,2) NOT NULL,
    "newGrossSalary" DECIMAL(12,2) NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedByTelegramId" BIGINT,
    "approvedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_change_logs" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldNameAr" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "oldDisplayValue" TEXT,
    "newDisplayValue" TEXT,
    "reason" TEXT,
    "actorTelegramId" BIGINT NOT NULL,
    "actorName" TEXT,
    "actorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_custom_allowances" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "allowanceType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_custom_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppe_assets" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "brandModel" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledReplacementDate" TIMESTAMP(3),
    "costPrice" DECIMAL(10,2) NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "returnDate" TIMESTAMP(3),
    "isDeductedFromWorker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ppe_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_and_bonuses" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "daysEquivalent" DECIMAL(6,2),
    "reason" TEXT NOT NULL,
    "decisionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedToMonth" TEXT,
    "approvedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplinary_and_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_clearances" (
    "id" TEXT NOT NULL,
    "clearanceNumber" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "serviceDurationDays" INTEGER NOT NULL,
    "accruedLeaveDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "endOfServiceGratuity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalUnpaidSalaries" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOutstandingAdvances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "custodiesReturned" BOOLEAN NOT NULL DEFAULT true,
    "ppeReturned" BOOLEAN NOT NULL DEFAULT true,
    "netSettlementAmount" DECIMAL(12,2) NOT NULL,
    "paymentVoucherNumber" TEXT,
    "receiptPhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_balance_snapshots" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "totalEarnedAllTime" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPaidAllTime" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentMonthAdvances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstandingLoansBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastUpdatedLedgerHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "leaveNumber" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "expectedReturnDate" TIMESTAMP(3) NOT NULL,
    "actualReturnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "overdueDays" INTEGER NOT NULL DEFAULT 0,
    "penaltyDaysCalculated" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isOverstayPardoned" BOOLEAN NOT NULL DEFAULT false,
    "overstayPardonReason" TEXT,
    "supervisorNotes" TEXT,
    "approvedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_allowances" (
    "id" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "travelStipend" DECIMAL(10,2) NOT NULL,
    "disbursedFromCustodyId" TEXT,
    "disbursementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucherNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_rosters" (
    "id" TEXT NOT NULL,
    "dutyDate" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "shiftType" TEXT NOT NULL DEFAULT 'DAY_SHIFT',
    "hoursWorked" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_tasks" (
    "id" TEXT NOT NULL,
    "taskNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToWorkerId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attachmentUri" TEXT,
    "sha256Checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_treasuries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'MAIN_CASH_VAULT',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_treasuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_custodies" (
    "id" TEXT NOT NULL,
    "custodyNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "custodianWorkerId" TEXT NOT NULL,
    "initialAmount" DECIMAL(14,2) NOT NULL,
    "currentBalance" DECIMAL(14,2) NOT NULL,
    "totalLiquidatedExpenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCashAdvancesDisbursed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disbursedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "disbursedFromTreasuryId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_custodies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_expense_items" (
    "id" TEXT NOT NULL,
    "custodyId" TEXT NOT NULL,
    "itemSequence" INTEGER NOT NULL,
    "expenseCategory" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vendorName" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "receiptImageUri" TEXT,
    "sha256Checksum" TEXT,
    "ocrExtractedData" JSONB,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_settlements" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "custodyId" TEXT NOT NULL,
    "closingTotalInvoices" DECIMAL(14,2) NOT NULL,
    "closingTotalAdvances" DECIMAL(14,2) NOT NULL,
    "remainingCashReturned" DECIMAL(14,2) NOT NULL,
    "settlementDisposition" TEXT NOT NULL DEFAULT 'REFUND_TO_TREASURY',
    "settlementSheetPhotoUri" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_AUDIT',
    "auditedByUserId" BIGINT,
    "settledAt" TIMESTAMP(3),
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custody_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitality_expenses" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "guestNameOrEntity" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "sourceCustodyId" TEXT,
    "disbursedByWorkerId" TEXT,
    "receiptPhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitality_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_expense_claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "receiptImageUri" TEXT,
    "receiptSha256" TEXT,
    "settlementType" TEXT,
    "settlementCustodyId" TEXT,
    "settlementTreasuryTransactionId" TEXT,
    "payrollRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rejectionReason" TEXT,
    "approvedByUserId" BIGINT,
    "settledAt" TIMESTAMP(3),
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amountRequested" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "installmentMonths" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedAmount" DECIMAL(12,2),
    "approvedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ledgers" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionType" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "sourceAccount" TEXT NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "sourceCustodyId" TEXT,
    "workerId" TEXT,
    "supplierId" TEXT,
    "canteenItemId" TEXT,
    "inKindDetails" JSONB,
    "description" TEXT,
    "accountingMonth" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfVoucherId" TEXT,
    "actorTelegramId" BIGINT NOT NULL,
    "receiptPhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" BIGINT,
    "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedToSheets" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "financial_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_installments" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "originalVoucherNumber" TEXT NOT NULL,
    "installmentSequence" INTEGER NOT NULL,
    "dueMonth" TEXT NOT NULL,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deductedInPayrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phoneEncrypted" TEXT,
    "phoneBlindIndex" TEXT,
    "taxNumber" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalInvoiced" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "scope" TEXT NOT NULL DEFAULT 'FIELD',
    "siteId" TEXT,
    "telegramId" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "subtotalAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(14,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "description" TEXT,
    "invoicePhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemSequence" INTEGER NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH_CUSTODY',
    "disbursedFromTreasuryId" TEXT,
    "disbursedFromCustodyId" TEXT,
    "transactionReference" TEXT,
    "receiptPhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "record_hash" TEXT NOT NULL DEFAULT '',
    "previous_hash" TEXT,
    "hash_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "modelYear" INTEGER,
    "plateNumber" TEXT,
    "chassisNumber" TEXT,
    "siteId" TEXT NOT NULL,
    "assignedWorkerId" TEXT,
    "meterType" TEXT NOT NULL DEFAULT 'HOURS',
    "currentMeterReading" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currentFuelLevelPercentage" DECIMAL(5,2),
    "technicalStatus" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "lastMaintenanceDate" TIMESTAMP(3),
    "nextScheduledMaintenanceMeter" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_tanks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL_SOLAR',
    "totalCapacityLiters" DECIMAL(10,2) NOT NULL,
    "currentStockLiters" DECIMAL(10,2) NOT NULL,
    "minSafetyThresholdLiters" DECIMAL(10,2) NOT NULL,
    "supervisorWorkerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_tanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_dispense_logs" (
    "id" TEXT NOT NULL,
    "dispenseNumber" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "operatorWorkerId" TEXT NOT NULL,
    "litersDispensed" DECIMAL(10,2) NOT NULL,
    "meterReadingAtDispense" DECIMAL(10,2) NOT NULL,
    "unitCostPerLiter" DECIMAL(8,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "dispensedByUserId" BIGINT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_dispense_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_maintenances" (
    "id" TEXT NOT NULL,
    "maintenanceNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "meterReading" DECIMAL(10,2) NOT NULL,
    "supplierId" TEXT,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "nextDueMeterReading" DECIMAL(10,2),
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_parts_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "estimatedCost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spare_parts_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_items" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "currentStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reorderThreshold" DECIMAL(10,2) NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canteen_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_food_items" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "currentStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "weightedAverageCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reorderThreshold" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camp_food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_inbound_shipments" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalInvoiceAmount" DECIMAL(12,2) NOT NULL,
    "qualityInspectionStatus" TEXT NOT NULL DEFAULT 'ACCEPTED_FULL',
    "receivedByWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_inbound_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealCategory" TEXT NOT NULL,
    "standardPortionGrams" INTEGER NOT NULL DEFAULT 400,
    "ingredientsBreakdown" JSONB NOT NULL,
    "targetCostPerMeal" DECIMAL(8,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_meal_dispenses" (
    "id" TEXT NOT NULL,
    "dispenseDate" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "servingsCount" INTEGER NOT NULL,
    "totalIngredientsCost" DECIMAL(12,2) NOT NULL,
    "actualCostPerServing" DECIMAL(8,2) NOT NULL,
    "chefWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_meal_dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_waste_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foodItemCode" TEXT NOT NULL,
    "wasteQuantityKg" DECIMAL(8,2) NOT NULL,
    "wasteReason" TEXT NOT NULL,
    "estimatedLossCost" DECIMAL(10,2) NOT NULL,
    "supervisorNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_waste_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_surveys" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "surveyDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_price_benchmarks" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "benchmarkPrice" DECIMAL(10,2) NOT NULL,
    "surveyDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_price_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phosphate_production_slips" (
    "id" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "truckPlateNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "transportCompany" TEXT,
    "oreGrade" TEXT NOT NULL DEFAULT 'GRADE_A_CONCENTRATE',
    "grossWeightTons" DECIMAL(10,3) NOT NULL,
    "tareWeightTons" DECIMAL(10,3) NOT NULL,
    "netWeightTons" DECIMAL(10,3) NOT NULL,
    "destination" TEXT,
    "slipPhotoUri" TEXT,
    "sha256Checksum" TEXT,
    "loadingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phosphate_production_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phosphate_extracts" (
    "id" TEXT NOT NULL,
    "extractNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientEntityName" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "totalTonnageDelivered" DECIMAL(12,3) NOT NULL,
    "contractRatePerTon" DECIMAL(10,2) NOT NULL,
    "grossExtractValue" DECIMAL(14,2) NOT NULL,
    "deductionsAndRetentions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayableAmount" DECIMAL(14,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "collectionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phosphate_extracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "siteId" TEXT,
    "totalContractedPayroll" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGrossEarnings" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetSalariesPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT_CALCULATING',
    "approvedByUserId" BIGINT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "daysWorked" DECIMAL(5,2) NOT NULL,
    "daysAbsent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "daysOnLeave" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "baseDailyWage" DECIMAL(12,2) NOT NULL,
    "earnedBasicSalary" DECIMAL(12,2) NOT NULL,
    "overtimeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonusesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customAllowancesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reimbursementsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossEarnings" DECIMAL(14,2) NOT NULL,
    "cashAdvancesDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cigaretteWithdrawalsDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "purchaseWithdrawalsDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penaltiesDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loanInstallmentDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL,
    "netSalaryPayable" DECIMAL(14,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "payoutMethod" TEXT NOT NULL DEFAULT 'CASH_ENVELOPE',
    "payoutReference" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "workerId" TEXT,
    "supplierId" TEXT,
    "assignedSiteId" TEXT,
    "phoneEncrypted" TEXT,
    "phoneBlindIndex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "approvedBySuperAdminId" BIGINT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_menu_permissions" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_menu_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorTelegramId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforePayload" JSONB,
    "afterPayload" JSONB,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_performance_logs" (
    "id" TEXT NOT NULL,
    "actorTelegramId" BIGINT NOT NULL,
    "callbackQueryOrCommand" TEXT NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "dbQueryCount" INTEGER NOT NULL DEFAULT 0,
    "performanceTier" TEXT NOT NULL DEFAULT 'GREEN_FAST',
    "memoryUsageMb" DECIMAL(8,2),
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedByTelegramId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewDecisionNotes" TEXT,
    "reviewedByTelegramId" BIGINT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wizard_drafts" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "wizardName" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "draftData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_wizard_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dispatch_queues" (
    "id" TEXT NOT NULL,
    "recipientTelegramId" BIGINT NOT NULL,
    "userId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'GENERAL_ALERT',
    "messageText" TEXT NOT NULL,
    "inlineKeyboard" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_dispatch_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_error_logs" (
    "id" TEXT NOT NULL,
    "errorReference" TEXT NOT NULL,
    "errorHash" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "actorTelegramId" BIGINT,
    "actorRole" TEXT,
    "actionTrigger" TEXT,
    "sourceLocation" TEXT,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "breadcrumbs" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes & Unique Constraints
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX "job_titles_departmentId_code_key" ON "job_titles"("departmentId", "code");
CREATE INDEX "cycle_transition_history_targetType_targetId_effectiveDate_idx" ON "cycle_transition_history"("targetType", "targetId", "effectiveDate");
CREATE INDEX "cycle_transition_history_effectiveDate_idx" ON "cycle_transition_history"("effectiveDate");
CREATE UNIQUE INDEX "workers_code_key" ON "workers"("code");
CREATE UNIQUE INDEX "workers_nationalIdBlindIndex_key" ON "workers"("nationalIdBlindIndex");
CREATE UNIQUE INDEX "workers_passportBlindIndex_key" ON "workers"("passportBlindIndex");
CREATE UNIQUE INDEX "workers_telegramId_key" ON "workers"("telegramId");
CREATE INDEX "workers_phoneBlindIndex_idx" ON "workers"("phoneBlindIndex");
CREATE INDEX "workers_status_idx" ON "workers"("status");
CREATE INDEX "workers_isDeleted_idx" ON "workers"("isDeleted");
CREATE INDEX "workers_legacyCode_idx" ON "workers"("legacyCode");
CREATE INDEX "workers_idCardExpiryDate_idx" ON "workers"("idCardExpiryDate");
CREATE INDEX "worker_documents_workerId_idx" ON "worker_documents"("workerId");
CREATE UNIQUE INDEX "worker_edit_requests_requestId_key" ON "worker_edit_requests"("requestId");
CREATE INDEX "worker_edit_requests_status_idx" ON "worker_edit_requests"("status");
CREATE INDEX "worker_edit_requests_workerId_idx" ON "worker_edit_requests"("workerId");
CREATE INDEX "worker_edit_requests_workerCode_idx" ON "worker_edit_requests"("workerCode");
CREATE UNIQUE INDEX "salary_histories_changeId_key" ON "salary_histories"("changeId");
CREATE INDEX "salary_histories_workerId_effectiveDate_idx" ON "salary_histories"("workerId", "effectiveDate");
CREATE INDEX "salary_histories_effectiveMonth_idx" ON "salary_histories"("effectiveMonth");
CREATE UNIQUE INDEX "worker_change_logs_changeId_key" ON "worker_change_logs"("changeId");
CREATE INDEX "worker_change_logs_workerId_createdAt_idx" ON "worker_change_logs"("workerId", "createdAt");
CREATE INDEX "worker_change_logs_category_idx" ON "worker_change_logs"("category");
CREATE INDEX "worker_change_logs_fieldKey_idx" ON "worker_change_logs"("fieldKey");
CREATE UNIQUE INDEX "ppe_assets_voucherId_key" ON "ppe_assets"("voucherId");
CREATE UNIQUE INDEX "disciplinary_and_bonuses_recordNumber_key" ON "disciplinary_and_bonuses"("recordNumber");
CREATE UNIQUE INDEX "worker_clearances_clearanceNumber_key" ON "worker_clearances"("clearanceNumber");
CREATE UNIQUE INDEX "worker_clearances_workerId_key" ON "worker_clearances"("workerId");
CREATE UNIQUE INDEX "worker_balance_snapshots_workerId_key" ON "worker_balance_snapshots"("workerId");
CREATE UNIQUE INDEX "leaves_leaveNumber_key" ON "leaves"("leaveNumber");
CREATE UNIQUE INDEX "duty_rosters_dutyDate_workerId_key" ON "duty_rosters"("dutyDate", "workerId");
CREATE UNIQUE INDEX "site_tasks_taskNumber_key" ON "site_tasks"("taskNumber");
CREATE UNIQUE INDEX "financial_custodies_custodyNumber_key" ON "financial_custodies"("custodyNumber");

-- Cryptographic Hash-Chain Indexes on Financial Models
CREATE INDEX "custody_expense_items_record_hash_idx" ON "custody_expense_items"("record_hash");
CREATE INDEX "custody_expense_items_previous_hash_idx" ON "custody_expense_items"("previous_hash");
CREATE INDEX "custody_expense_items_hash_timestamp_idx" ON "custody_expense_items"("hash_timestamp");

CREATE UNIQUE INDEX "custody_settlements_settlementNumber_key" ON "custody_settlements"("settlementNumber");
CREATE INDEX "custody_settlements_record_hash_idx" ON "custody_settlements"("record_hash");
CREATE INDEX "custody_settlements_previous_hash_idx" ON "custody_settlements"("previous_hash");
CREATE INDEX "custody_settlements_hash_timestamp_idx" ON "custody_settlements"("hash_timestamp");

CREATE UNIQUE INDEX "hospitality_expenses_voucherId_key" ON "hospitality_expenses"("voucherId");
CREATE INDEX "hospitality_expenses_record_hash_idx" ON "hospitality_expenses"("record_hash");
CREATE INDEX "hospitality_expenses_previous_hash_idx" ON "hospitality_expenses"("previous_hash");
CREATE INDEX "hospitality_expenses_hash_timestamp_idx" ON "hospitality_expenses"("hash_timestamp");

CREATE UNIQUE INDEX "worker_expense_claims_claimNumber_key" ON "worker_expense_claims"("claimNumber");
CREATE INDEX "worker_expense_claims_workerId_idx" ON "worker_expense_claims"("workerId");
CREATE INDEX "worker_expense_claims_siteId_idx" ON "worker_expense_claims"("siteId");
CREATE INDEX "worker_expense_claims_status_idx" ON "worker_expense_claims"("status");
CREATE INDEX "worker_expense_claims_settlementType_idx" ON "worker_expense_claims"("settlementType");
CREATE INDEX "worker_expense_claims_record_hash_idx" ON "worker_expense_claims"("record_hash");
CREATE INDEX "worker_expense_claims_previous_hash_idx" ON "worker_expense_claims"("previous_hash");
CREATE INDEX "worker_expense_claims_hash_timestamp_idx" ON "worker_expense_claims"("hash_timestamp");

CREATE UNIQUE INDEX "advance_requests_requestNumber_key" ON "advance_requests"("requestNumber");

CREATE UNIQUE INDEX "financial_ledgers_voucherNumber_key" ON "financial_ledgers"("voucherNumber");
CREATE INDEX "financial_ledgers_transactionType_idx" ON "financial_ledgers"("transactionType");
CREATE INDEX "financial_ledgers_sourceAccount_idx" ON "financial_ledgers"("sourceAccount");
CREATE INDEX "financial_ledgers_sourceCustodyId_idx" ON "financial_ledgers"("sourceCustodyId");
CREATE INDEX "financial_ledgers_destinationAccount_idx" ON "financial_ledgers"("destinationAccount");
CREATE INDEX "financial_ledgers_syncedToSheets_idx" ON "financial_ledgers"("syncedToSheets");
CREATE INDEX "financial_ledgers_record_hash_idx" ON "financial_ledgers"("record_hash");
CREATE INDEX "financial_ledgers_previous_hash_idx" ON "financial_ledgers"("previous_hash");
CREATE INDEX "financial_ledgers_hash_timestamp_idx" ON "financial_ledgers"("hash_timestamp");

CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");
CREATE UNIQUE INDEX "suppliers_telegramId_key" ON "suppliers"("telegramId");
CREATE INDEX "suppliers_phoneBlindIndex_idx" ON "suppliers"("phoneBlindIndex");

CREATE UNIQUE INDEX "supplier_invoices_invoiceNumber_key" ON "supplier_invoices"("invoiceNumber");

CREATE UNIQUE INDEX "supplier_payments_paymentNumber_key" ON "supplier_payments"("paymentNumber");
CREATE INDEX "supplier_payments_record_hash_idx" ON "supplier_payments"("record_hash");
CREATE INDEX "supplier_payments_previous_hash_idx" ON "supplier_payments"("previous_hash");
CREATE INDEX "supplier_payments_hash_timestamp_idx" ON "supplier_payments"("hash_timestamp");

CREATE UNIQUE INDEX "equipments_code_key" ON "equipments"("code");
CREATE UNIQUE INDEX "fuel_tanks_code_key" ON "fuel_tanks"("code");
CREATE UNIQUE INDEX "fuel_dispense_logs_dispenseNumber_key" ON "fuel_dispense_logs"("dispenseNumber");
CREATE UNIQUE INDEX "equipment_maintenances_maintenanceNumber_key" ON "equipment_maintenances"("maintenanceNumber");
CREATE UNIQUE INDEX "spare_parts_requests_requestNumber_key" ON "spare_parts_requests"("requestNumber");
CREATE UNIQUE INDEX "canteen_items_code_key" ON "canteen_items"("code");
CREATE UNIQUE INDEX "camp_food_items_code_key" ON "camp_food_items"("code");
CREATE UNIQUE INDEX "food_inbound_shipments_shipmentNumber_key" ON "food_inbound_shipments"("shipmentNumber");
CREATE UNIQUE INDEX "phosphate_production_slips_slipNumber_key" ON "phosphate_production_slips"("slipNumber");
CREATE UNIQUE INDEX "phosphate_extracts_extractNumber_key" ON "phosphate_extracts"("extractNumber");
CREATE UNIQUE INDEX "payroll_runs_runNumber_key" ON "payroll_runs"("runNumber");
CREATE UNIQUE INDEX "payroll_runs_tenantId_year_month_siteId_key" ON "payroll_runs"("tenantId", "year", "month", "siteId");
CREATE UNIQUE INDEX "payroll_records_payrollRunId_workerId_key" ON "payroll_records"("payrollRunId", "workerId");
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");
CREATE UNIQUE INDEX "users_workerId_key" ON "users"("workerId");
CREATE UNIQUE INDEX "users_supplierId_key" ON "users"("supplierId");
CREATE INDEX "users_phoneBlindIndex_idx" ON "users"("phoneBlindIndex");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE UNIQUE INDEX "bot_menu_permissions_role_featureKey_key" ON "bot_menu_permissions"("role", "featureKey");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_actorTelegramId_timestamp_idx" ON "audit_logs"("actorTelegramId", "timestamp");
CREATE INDEX "bot_performance_logs_performanceTier_timestamp_idx" ON "bot_performance_logs"("performanceTier", "timestamp");
CREATE UNIQUE INDEX "approval_tickets_ticketNumber_key" ON "approval_tickets"("ticketNumber");
CREATE INDEX "approval_tickets_status_ticketType_idx" ON "approval_tickets"("status", "ticketType");
CREATE UNIQUE INDEX "user_wizard_drafts_telegramId_key" ON "user_wizard_drafts"("telegramId");
CREATE INDEX "notification_dispatch_queues_status_scheduledFor_priority_idx" ON "notification_dispatch_queues"("status", "scheduledFor", "priority");
CREATE INDEX "outbox_events_status_createdAt_idx" ON "outbox_events"("status", "createdAt");
CREATE UNIQUE INDEX "system_error_logs_errorReference_key" ON "system_error_logs"("errorReference");
CREATE INDEX "system_error_logs_severity_createdAt_idx" ON "system_error_logs"("severity", "createdAt");
CREATE INDEX "system_error_logs_errorHash_isResolved_idx" ON "system_error_logs"("errorHash", "isResolved");
CREATE INDEX "system_error_logs_actorTelegramId_createdAt_idx" ON "system_error_logs"("actorTelegramId", "createdAt");

-- Foreign Keys
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sites" ADD CONSTRAINT "sites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_accommodations" ADD CONSTRAINT "site_accommodations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_accommodation_assignments" ADD CONSTRAINT "site_accommodation_assignments_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "site_accommodations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_accommodation_assignments" ADD CONSTRAINT "site_accommodation_assignments_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "job_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workers" ADD CONSTRAINT "workers_canteenItemId_fkey" FOREIGN KEY ("canteenItemId") REFERENCES "canteen_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_documents" ADD CONSTRAINT "worker_documents_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_edit_requests" ADD CONSTRAINT "worker_edit_requests_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_histories" ADD CONSTRAINT "salary_histories_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_change_logs" ADD CONSTRAINT "worker_change_logs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_custom_allowances" ADD CONSTRAINT "worker_custom_allowances_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ppe_assets" ADD CONSTRAINT "ppe_assets_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disciplinary_and_bonuses" ADD CONSTRAINT "disciplinary_and_bonuses_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "worker_clearances" ADD CONSTRAINT "worker_clearances_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "worker_balance_snapshots" ADD CONSTRAINT "worker_balance_snapshots_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_allowances" ADD CONSTRAINT "leave_allowances_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "leaves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_allowances" ADD CONSTRAINT "leave_allowances_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_allowances" ADD CONSTRAINT "leave_allowances_disbursedFromCustodyId_fkey" FOREIGN KEY ("disbursedFromCustodyId") REFERENCES "financial_custodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "duty_rosters" ADD CONSTRAINT "duty_rosters_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_rosters" ADD CONSTRAINT "duty_rosters_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_rosters" ADD CONSTRAINT "duty_rosters_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_tasks" ADD CONSTRAINT "site_tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_tasks" ADD CONSTRAINT "site_tasks_assignedToWorkerId_fkey" FOREIGN KEY ("assignedToWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_treasuries" ADD CONSTRAINT "company_treasuries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_custodies" ADD CONSTRAINT "financial_custodies_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_custodies" ADD CONSTRAINT "financial_custodies_custodianWorkerId_fkey" FOREIGN KEY ("custodianWorkerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_custodies" ADD CONSTRAINT "financial_custodies_disbursedFromTreasuryId_fkey" FOREIGN KEY ("disbursedFromTreasuryId") REFERENCES "company_treasuries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "custody_expense_items" ADD CONSTRAINT "custody_expense_items_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "financial_custodies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "custody_settlements" ADD CONSTRAINT "custody_settlements_custodyId_fkey" FOREIGN KEY ("custodyId") REFERENCES "financial_custodies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hospitality_expenses" ADD CONSTRAINT "hospitality_expenses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hospitality_expenses" ADD CONSTRAINT "hospitality_expenses_sourceCustodyId_fkey" FOREIGN KEY ("sourceCustodyId") REFERENCES "financial_custodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hospitality_expenses" ADD CONSTRAINT "hospitality_expenses_disbursedByWorkerId_fkey" FOREIGN KEY ("disbursedByWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_expense_claims" ADD CONSTRAINT "worker_expense_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "worker_expense_claims" ADD CONSTRAINT "worker_expense_claims_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "worker_expense_claims" ADD CONSTRAINT "worker_expense_claims_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "worker_expense_claims" ADD CONSTRAINT "worker_expense_claims_settlementCustodyId_fkey" FOREIGN KEY ("settlementCustodyId") REFERENCES "financial_custodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "worker_expense_claims" ADD CONSTRAINT "worker_expense_claims_payrollRecordId_fkey" FOREIGN KEY ("payrollRecordId") REFERENCES "payroll_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advance_requests" ADD CONSTRAINT "advance_requests_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_ledgers" ADD CONSTRAINT "financial_ledgers_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_ledgers" ADD CONSTRAINT "financial_ledgers_sourceCustodyId_fkey" FOREIGN KEY ("sourceCustodyId") REFERENCES "financial_custodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_ledgers" ADD CONSTRAINT "financial_ledgers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_ledgers" ADD CONSTRAINT "financial_ledgers_canteenItemId_fkey" FOREIGN KEY ("canteenItemId") REFERENCES "canteen_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_originalVoucherNumber_fkey" FOREIGN KEY ("originalVoucherNumber") REFERENCES "financial_ledgers"("voucherNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_deductedInPayrollRunId_fkey" FOREIGN KEY ("deductedInPayrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_disbursedFromTreasuryId_fkey" FOREIGN KEY ("disbursedFromTreasuryId") REFERENCES "company_treasuries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_disbursedFromCustodyId_fkey" FOREIGN KEY ("disbursedFromCustodyId") REFERENCES "financial_custodies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_supervisorWorkerId_fkey" FOREIGN KEY ("supervisorWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_dispense_logs" ADD CONSTRAINT "fuel_dispense_logs_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "fuel_tanks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_dispense_logs" ADD CONSTRAINT "fuel_dispense_logs_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_dispense_logs" ADD CONSTRAINT "fuel_dispense_logs_operatorWorkerId_fkey" FOREIGN KEY ("operatorWorkerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_maintenances" ADD CONSTRAINT "equipment_maintenances_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_maintenances" ADD CONSTRAINT "equipment_maintenances_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "spare_parts_requests" ADD CONSTRAINT "spare_parts_requests_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "spare_parts_requests" ADD CONSTRAINT "spare_parts_requests_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "canteen_items" ADD CONSTRAINT "canteen_items_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "camp_food_items" ADD CONSTRAINT "camp_food_items_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_inbound_shipments" ADD CONSTRAINT "food_inbound_shipments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_inbound_shipments" ADD CONSTRAINT "food_inbound_shipments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_inbound_shipments" ADD CONSTRAINT "food_inbound_shipments_receivedByWorkerId_fkey" FOREIGN KEY ("receivedByWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kitchen_meal_dispenses" ADD CONSTRAINT "kitchen_meal_dispenses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kitchen_meal_dispenses" ADD CONSTRAINT "kitchen_meal_dispenses_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kitchen_meal_dispenses" ADD CONSTRAINT "kitchen_meal_dispenses_chefWorkerId_fkey" FOREIGN KEY ("chefWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "food_waste_logs" ADD CONSTRAINT "food_waste_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_surveys" ADD CONSTRAINT "meal_surveys_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_surveys" ADD CONSTRAINT "meal_surveys_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phosphate_production_slips" ADD CONSTRAINT "phosphate_production_slips_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "phosphate_extracts" ADD CONSTRAINT "phosphate_extracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_assignedSiteId_fkey" FOREIGN KEY ("assignedSiteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_dispatch_queues" ADD CONSTRAINT "notification_dispatch_queues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
