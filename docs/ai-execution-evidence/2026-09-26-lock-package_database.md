# توثيق الحوكمة: قفل وحماية الكيان تشفيرياً (package:database)

- **تاريخ القفل:** 2026-09-26 (2026-09-26T13:23:50.700Z)
- **معرف الكيان:** `package:database`
- **نوع الكيان:** `package`
- **العنوان:** حزمة النواة: @alsaada/database
- **المسار الأساسي:** `packages/database`
- **عدد الملفات المقفلة:** 37 ملفاً
- **الحالة:** 🟢 مقفل ومحصن تشفيرياً 100% (Zero Blast Radius)
- **مرجع الالتزام (Commit):** `Plan-70-Lock`

## قائمة البصمات الجنائية (SHA-256)
| المسار | بصمة الهاش (SHA-256) |
| :--- | :--- |
| `packages/database/CHANGELOG.md` | `9306c7957c1fa2e1ee9fa80ab06abe82e9a43b195e707736e801e6f094a92148` |
| `packages/database/package.json` | `6b2de90119dcf6beb859dbd6d992f914707664fc065331c17282b16de174fe0f` |
| `packages/database/prisma.config.ts` | `d8bb7c86917ef2734f1443c6e96618c9c051b082468746ff0304aa67ebfa7f5b` |
| `packages/database/prisma/migrations/20260911000000_init_enterprise_hash_ledger/migration.sql` | `30ca6a54b21f14cc6233e8e667b69c437522f77453ebe2cd9e4b45e9c7cecaee` |
| `packages/database/prisma/migrations/20260912090000_add_trace_incidents_and_magic_claim/migration.sql` | `dc6fcabbc939db2b4f9e3a55a359e975da821101425cf50fbc749b990a232118` |
| `packages/database/prisma/migrations/20260913010000_align_financial_ledger_hash_defaults/migration.sql` | `4871d26a537ecee548e54aa2ce493ed386ea84e42e7e48830f20ff4b5fe243b7` |
| `packages/database/prisma/migrations/20260913100000_unified_rbac_auth_links_and_sessions/migration.sql` | `ff1c5591d936b5dc4f3cfbb1e794acf96565586f7b8a7e480f377e0b8d027686` |
| `packages/database/prisma/migrations/20260913210000_dashboard_auth_hardening_ssot/migration.sql` | `56f88bc023701ec3d9966918705e9a11fa0a21919522d56c19695b6f9aae1f88` |
| `packages/database/prisma/migrations/20260914120000_workforce_parity_and_canteen_price_history/migration.sql` | `09f6367807c58f73e4af9633649f55b181ca42f84526d86fe6c44f655ceeabb7` |
| `packages/database/prisma/migrations/20260916000000_telemetry_bot_performance_columns/migration.sql` | `18b421ef4dfbdeb21274cbaebe079d90de5b4ae83c16ad436080483c05dae191` |
| `packages/database/prisma/migrations/20260917010000_add_ppe_site_and_worker_commitment_scores/migration.sql` | `5fa03cdbcb8db1bd694e56404c896231b0610f57fd333a54f0b29c7d3f7e8f9c` |
| `packages/database/prisma/migrations/20260918_immutable_financial_ledger_triggers/migration.sql` | `aae5ec466141299c6d58742c6674e6ba3518a417a5440f375256793dd81a8e5a` |
| `packages/database/prisma/migrations/20260925210000_single_company_nullable_tenant/migration.sql` | `4cc02faccbfa751c523e484b29a772aaef112bff672f2152a6c4779078b476ce` |
| `packages/database/prisma/migrations/20260926120000_modular_database_emancipation_and_ghost_table_purge/migration.sql` | `398ab9fd7aa09e2c0dbf1e3a26547fb63247517ab1ae4c2e14890b2fbab04846` |
| `packages/database/prisma/migrations/migration_lock.toml` | `162ff5818ed32b5113b4fb76482715281a9f8809c6ebd1b72dd604de469f1746` |
| `packages/database/prisma/schema.prisma` | `464484856947b552d362fd6762d1a1bf6c01083062b416a0cf7800936f7d0bc3` |
| `packages/database/prisma/seed-data/company-profile.json` | `fb24b8c44560a7bee5a53d1b1edcb9930fedf254755c40c6675cbd49632ce77a` |
| `packages/database/prisma/seeds/bot-menu-catalog.seed.ts` | `d34d10481cf6765d7eaf3dcdd3d6ba69719cf722d46cc21f026256241745e115` |
| `packages/database/src/client.ts` | `5da20d0e2cff368b0ab29194cd47c4e978441b619ada661467dde2026136ee30` |
| `packages/database/src/crypto/blind-index.ts` | `2ac9290b9870b11691db875f68c74aa7a77a9b3ba57541ec4c747a9e2457a7c9` |
| `packages/database/src/crypto/cipher.ts` | `3d0043d35be884e7a90e0ffa4dabe1feda9daaa619a6cbc40d00de08f2c326f5` |
| `packages/database/src/extensions/soft-delete-metadata.ts` | `fc2a92f8696badc5a2695dc0267918a66d675481402f38e95d9d686b982d3752` |
| `packages/database/src/extensions/soft-delete.extension.ts` | `dbdbc2813ef3aa19cd00bcf838c3e548a207fbee6383f490a838434a3abdbaac` |
| `packages/database/src/index.ts` | `087a4378b47e154f9e88f55f0ace8df72e29f08204ad4a349c5ca0ccf95a93f8` |
| `packages/database/src/ledger/hash-chain.ts` | `181bebd39b5d387e9ce61642cad8f8a2bf7f369fa2e614c8ef0a62a8412ca280` |
| `packages/database/src/ledger/hash-ledger.extension.ts` | `5c06c2decceec0ff65707ff91a6b03dff58db6f9f66afeb109ff4d4363cadaf6` |
| `packages/database/src/ledger/verify-ledger-chain.ts` | `81b5c431166db2ae8d312f30ae554ba432ef387b9b75fff754abdaaf7acc9663` |
| `packages/database/src/repositories/custody-transaction.repository.ts` | `a7e63e367d2757ba04590435271b6c65bc01e0fa545858359b41a32f6d7292a8` |
| `packages/database/src/scripts/purge-test-data.ts` | `3313e0a136663baf1e772a243115de0509773a70f9c606fb8dd4c3ea21fa505f` |
| `packages/database/src/scripts/remediate-job-matrix-and-cycles.ts` | `c0a2b39570ca0de63ceca49c7cfc95b6965a0eed627b1768b4f2ad29f3b4af0c` |
| `packages/database/src/scripts/remediate-shift-templates-and-jobs.ts` | `9b798a65b9b0a08395df9eee8bb5a386a6e3c22f2f64b761e6a0c6e7c9d88600` |
| `packages/database/src/scripts/seed-bot-menu-catalog.ts` | `4a7be35683cd64eccc6ddc90ad7ab783d79c3ae82dab4259f98705b0ed5a83d0` |
| `packages/database/src/scripts/seed-canteen-cigarettes.ts` | `2b5f1c0fec856feafcfd8812e8d13bb5067d476b9d0d3ab624639b4586b9dc2b` |
| `packages/database/src/scripts/seed-company-profile.ts` | `449f6ee4dfda0393304ac0e2ee5a03bf876b418aca5d76c7f3cbd49c0f35fa0f` |
| `packages/database/src/scripts/seed-hq-site.ts` | `c2f1682fb7c267a1177f953e825697013ce67b6da75faaa9ef3b975618c399dc` |
| `packages/database/src/scripts/studio-bridge.mjs` | `be69d461ed600413a0c7f4c117cf99b31509c03eea9efc3551af902bd05444ea` |
| `packages/database/tsconfig.json` | `c4742ea95afd3be1738d8eda846345306033639c933d46d9b763577dd8845280` |

## بوابات التحقق المعتمدة
- **CRLF/LF Sanitization:** PASS
- **Tamper Protection:** ACTIVE
- **Zero Blast Radius:** ISOLATED
