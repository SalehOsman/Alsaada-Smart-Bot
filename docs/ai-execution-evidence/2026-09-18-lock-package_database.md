# توثيق الحوكمة: قفل وحماية الكيان تشفيرياً (package:database)

- **تاريخ القفل:** 2026-09-18 (2026-09-18T15:59:36.368Z)
- **معرف الكيان:** `package:database`
- **نوع الكيان:** `package`
- **العنوان:** حزمة النواة: @alsaada/database
- **المسار الأساسي:** `packages/database`
- **عدد الملفات المقفلة:** 40 ملفاً
- **الحالة:** 🟢 مقفل ومحصن تشفيرياً 100% (Zero Blast Radius)
- **مرجع الالتزام (Commit):** `Plan-70-Lock`

## قائمة البصمات الجنائية (SHA-256)
| المسار | بصمة الهاش (SHA-256) |
| :--- | :--- |
| `packages/database/package.json` | `d43c4364b646bb0c86ef2c2e968a95cd521d38249173af50f50de28498887c71` |
| `packages/database/prisma/migrations/20260911000000_init_enterprise_hash_ledger/migration.sql` | `30ca6a54b21f14cc6233e8e667b69c437522f77453ebe2cd9e4b45e9c7cecaee` |
| `packages/database/prisma/migrations/20260912090000_add_trace_incidents_and_magic_claim/migration.sql` | `dc6fcabbc939db2b4f9e3a55a359e975da821101425cf50fbc749b990a232118` |
| `packages/database/prisma/migrations/20260913010000_align_financial_ledger_hash_defaults/migration.sql` | `4871d26a537ecee548e54aa2ce493ed386ea84e42e7e48830f20ff4b5fe243b7` |
| `packages/database/prisma/migrations/20260913100000_unified_rbac_auth_links_and_sessions/migration.sql` | `ff1c5591d936b5dc4f3cfbb1e794acf96565586f7b8a7e480f377e0b8d027686` |
| `packages/database/prisma/migrations/20260913210000_dashboard_auth_hardening_ssot/migration.sql` | `56f88bc023701ec3d9966918705e9a11fa0a21919522d56c19695b6f9aae1f88` |
| `packages/database/prisma/migrations/20260914120000_workforce_parity_and_canteen_price_history/migration.sql` | `09f6367807c58f73e4af9633649f55b181ca42f84526d86fe6c44f655ceeabb7` |
| `packages/database/prisma/migrations/20260916000000_telemetry_bot_performance_columns/migration.sql` | `18b421ef4dfbdeb21274cbaebe079d90de5b4ae83c16ad436080483c05dae191` |
| `packages/database/prisma/migrations/20260917010000_add_ppe_site_and_worker_commitment_scores/migration.sql` | `5fa03cdbcb8db1bd694e56404c896231b0610f57fd333a54f0b29c7d3f7e8f9c` |
| `packages/database/prisma/migrations/20260918_immutable_financial_ledger_triggers/migration.sql` | `a36dc83bc79c9b3f6030b44eecf4ba0b936f08351b3b70716a2bce31909e6ffb` |
| `packages/database/prisma/migrations/migration_lock.toml` | `162ff5818ed32b5113b4fb76482715281a9f8809c6ebd1b72dd604de469f1746` |
| `packages/database/prisma/schema.prisma` | `e0dff24081c1bbdec96fd4771494fefb2fb1f9128b835b19be68fca10721f258` |
| `packages/database/prisma/seed-data/company-profile.json` | `318710c85b7b209e4330b14545d376e1426d61df11eb5d271a8945046650ee22` |
| `packages/database/prisma/seeds/bot-menu-catalog.seed.ts` | `bead69715e3def19b70bdd354b463fafee0efc83fd89dcf49d3b2f70f6a3512c` |
| `packages/database/src/client.ts` | `e0d529361ea7bde75b15bb1fb1538295a4b243926b730dc2e491a1758f47d958` |
| `packages/database/src/crypto/blind-index.ts` | `2ac9290b9870b11691db875f68c74aa7a77a9b3ba57541ec4c747a9e2457a7c9` |
| `packages/database/src/crypto/cipher.ts` | `3a378441b5748f42f48d25daace637dccf0b8e6d4da00ff4c57e3c75d81080cf` |
| `packages/database/src/extensions/soft-delete.extension.ts` | `8756812f01cc782130aa736d6bc8bbd49ecf207b93c8fa97bf6627f8ce6a3563` |
| `packages/database/src/index.ts` | `ab14f32ab9e9dacaf4467561d25cd606400cd4f9dd6d3d034819139346582ede` |
| `packages/database/src/ledger/hash-chain.ts` | `8bb0311e498147762355a12610b73bc00534b7738077f64148c079c8533edf20` |
| `packages/database/src/ledger/hash-ledger.extension.ts` | `99d40d49a190a41953ee26b532f0c5a0511fa7eadd5e8b2ce2575c39ece4fcb0` |
| `packages/database/src/ledger/verify-ledger-chain.ts` | `9d9e25fc57f9f510bd95372f0be2bc922cf2bf50e0026b7dd3b3bd6382134734` |
| `packages/database/src/scripts/purge-test-data.ts` | `3eb9b849847d1fab5317c7dfb649d8a0400667148ce147b6fd5c829ee43040d6` |
| `packages/database/src/scripts/remediate-job-matrix-and-cycles.ts` | `76fef90859a7a8267842a0feaa22e484519581f777fd811d3c5d8e840d21dc66` |
| `packages/database/src/scripts/remediate-shift-templates-and-jobs.ts` | `9e02b228b4bf1fa6285020cd74fb76b807db39cdb42eaf73808f0d7bd45188c1` |
| `packages/database/src/scripts/seed-bot-menu-catalog.ts` | `6f7c4b99a597c2fc0d11ddfc904d6216dcce35cbe7092f9ee3de542882dc8724` |
| `packages/database/src/scripts/seed-canteen-cigarettes.ts` | `1d4d459240605ba1b8f57abb59edbb9e0894b681880041ed05c1ccb56853fc40` |
| `packages/database/src/scripts/seed-company-profile.ts` | `816be27bcfdd3f7b15500436c4fda674d50c4b8e1ebc69f94558cc0e28c0bd7d` |
| `packages/database/src/scripts/seed-hq-site.ts` | `6b86f905aa941ed038d3863043c21d291eee26d9969b68db11c319dcc58ad33e` |
| `packages/database/tests/adversarial-m2-audit.spec.ts` | `700016e53e6d9ca4fbc0060c5c3a7ba739e8d7969e89c48cbe7a1edc86170bb7` |
| `packages/database/tests/hash-chain.spec.ts` | `2fc2b7ccfba89d847817804f5d3123ceb6223dbd766ac588209a11c13e82fa78` |
| `packages/database/tests/hash-chain.stress.spec.ts` | `b240defe69aff93359ce8564d5c1124ee9567f99641c1ebf50e1623918db696d` |
| `packages/database/tests/hash-ledger.extension.spec.ts` | `cc5a6964b890e424c2fb512f50b6cd3be46e84c3d042d0da7ae93f93f309e2aa` |
| `packages/database/tests/migration-rbac-and-sessions.spec.ts` | `ec706e76e60088ebaab9f35478cfb63ea0e043fa9f5e6fab6e5e7555e92fc035` |
| `packages/database/tests/migration-trace-and-magic-claim.spec.ts` | `bceae9be03546b83a4f59cdd55e04a73a0ab62d0f8cca4dac49f1f0b1538775f` |
| `packages/database/tests/milestone-1-schema-contract.spec.ts` | `63fef8e945dcb6a35e80be6b204ea09eb52af9472b46e9e4d18140146732af28` |
| `packages/database/tests/security.spec.ts` | `3475811269096a142127d367ce41e96c2541b427908fe8b3038a9747fd2c96bf` |
| `packages/database/tests/soft-delete.spec.ts` | `d53c4f27f569508eddece42f621cdc5a2a076b2c2b1264d25ed83f563f615611` |
| `packages/database/tests/verify-ledger-chain.spec.ts` | `b478fc6958ccbd3e1d154b2fb5dab054e65dce2e8f2e1684f2a6380d69a9ada8` |
| `packages/database/tsconfig.json` | `c4742ea95afd3be1738d8eda846345306033639c933d46d9b763577dd8845280` |

## بوابات التحقق المعتمدة
- **CRLF/LF Sanitization:** PASS
- **Tamper Protection:** ACTIVE
- **Zero Blast Radius:** ISOLATED
