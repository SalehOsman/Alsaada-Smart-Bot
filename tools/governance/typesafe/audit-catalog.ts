/**
 * Centralized TypeSafe System One Question & Rubric Catalog for Al-Saada Monorepo Governance.
 * In accordance with TypeSafe Best Practices:
 * "Put the constants (questions and thresholds) in a single place so they're easy to review."
 * (docs/references/typesafe.md)
 */

export interface NoulQuestion {
  type: 'noul';
  instructions: string | Record<string, unknown>;
  criteria?: {
    true?: string | Record<string, unknown>;
    false?: string | Record<string, unknown>;
  };
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: string | Record<string, unknown>;
  criteria: Record<string, string | Record<string, unknown>>;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string | Record<string, unknown>;
  criteria: Array<string | Record<string, unknown>>;
}

export type TypeSafeQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export const JEV_AUDIT_CATALOG = {
  // 1. Test Authenticity & Anti-Cheating (Gate G10 / G23)
  testAuthenticity: {
    assertsRealDomainState: {
      type: 'noul',
      instructions: {
        question: 'Does this test assert genuine domain state mutations, ledger balance updates, or database writes rather than superficial object existence?',
        focus: 'Look for expect(...) calls verifying concrete properties, calculations, or storage changes.',
      },
      criteria: {
        true: 'Asserts real domain calculation, database mutation, or financial ledger entry.',
        false: 'Only asserts superficial conditions like toBeDefined, toBeTruthy, or true === true (Green Mirage).',
      },
    } satisfies NoulQuestion,

    excessiveMocking: {
      type: 'noul',
      instructions: {
        question: 'Does this test mock away the core business calculation or domain logic that it is supposed to be testing?',
        focus: 'Examine vitest.fn() / vi.mock() to see if critical accounting rules are bypassed.',
      },
      criteria: {
        true: 'Core business calculation or ledger invariant is mocked out.',
        false: 'Calculations run against real domain entities or realistic database transactions.',
      },
    } satisfies NoulQuestion,

    assertionRigorScore: {
      type: 'score',
      instructions: 'Rate the rigor and depth of assertions in this test file.',
      criteria: [
        'Level 0: Pure Green Mirage (unasserted, mocked away, or trivial toBeTruthy).',
        'Level 1: Basic happy-path testing without edge cases or failure branch verification.',
        'Level 2: Robust domain verification checking valid states, error branches, and return structures.',
        'Level 3: Ironclad invariant verification including concurrency, double-entry ledgers, and zero blast radius.',
      ],
    } satisfies ScoreQuestion,
  },

  // 2. Telegram Mobile Ergonomics & Field Masking (Gate G5 / G8 / G22)
  telegramUx: {
    hasUnmaskedCompensation: {
      type: 'noul',
      instructions: {
        question: 'Does any message string, template, or confirmation card expose sensitive financial data (wages, net salary, daily rate, bonuses) without wrapping in spoiler tags or formatSpoiler?',
        focus: 'Inspect message templates for raw salary numbers.',
      },
      criteria: {
        true: 'Financial compensation or wage numbers appear in raw plain text.',
        false: 'All sensitive figures are properly masked with formatSpoiler or <tg-spoiler>.',
      },
    } satisfies NoulQuestion,

    buttonLabelErgonomics: {
      type: 'choice',
      instructions: 'Evaluate the button labels against the 16-character mobile viewport budget and clarity.',
      criteria: {
        optimal: 'All labels are <= 16 characters and use crisp, natural Arabic workforce terms.',
        truncated: 'One or more labels exceed 16 characters and will be truncated on 360px mobile viewports.',
        awkward_phrasing: 'Labels are within limits but use clumsy or literal machine translations.',
      },
    } satisfies ChoiceQuestion,
  },

  // 3. F:\HR Legacy Parity & Flow Contract (Gate G3 / G4)
  legacyParity: {
    stepParityWithLegacy: {
      type: 'noul',
      instructions: {
        question: 'Compare the newly implemented bot flow against the legacy F:\\HR reference flow. Are all wizard steps, input prompts, and confirmation checkpoints preserved with zero flow divergence?',
        focus: 'Ensure no steps were skipped, deleted, or altered without authorization.',
      },
      criteria: {
        true: '100% functional step parity with legacy F:\\HR flow.',
        false: 'Flow divergence detected: one or more wizard steps or business checks are missing or modified.',
      },
    } satisfies NoulQuestion,
  },

  // 4. Monorepo Architecture & 10-File Vertical Slice (Gate G1 / G2)
  architecture: {
    layerResponsibilitySeparation: {
      type: 'noul',
      instructions: {
        question: 'Does the controller or action handler adhere strictly to layer separation without executing direct database mutations or heavy business logic?',
        focus: 'Controller must delegate to service; service encapsulates business transactions.',
      },
      criteria: {
        true: 'Pure layer separation: controller delegates to service, validator handles Zod schemas.',
        false: 'Layer leakage: controller executes raw Prisma queries or embeds heavy business math.',
      },
    } satisfies NoulQuestion,
  },

  // 5. Git Diff & Silent Refactor Detection (Gate G14 / G15)
  diffAudit: {
    hasSilentTestWeakening: {
      type: 'noul',
      instructions: {
        question: 'Did this git diff delete, comment out, or weaken any pre-existing assertions to force a test pass instead of fixing broken source code?',
        focus: 'Compare old vs new test assertions in the diff.',
      },
      criteria: {
        true: 'Pre-existing assertions were deleted or weakened (Silent Refactoring).',
        false: 'Test assertions were preserved or strengthened.',
      },
    } satisfies NoulQuestion,

    scopeBlastRadius: {
      type: 'choice',
      instructions: 'Classify the blast radius of the changes in this git diff.',
      criteria: {
        isolated_slice: 'Changes are strictly confined to the active 10-file flow slice or feature directory.',
        shared_kernel_leak: 'Changes inadvertently modify packages/shared or core infrastructure without approval.',
        governance_tamper: 'Diff attempts to alter governance lockfiles, approval scripts, or quality gates.',
      },
    } satisfies ChoiceQuestion,
  },

  // 6. Autoresearch Feature Discovery (Gate G3 / G11) - cookbooks/autoresearch_feature_discovery
  legacyFeatureDiscovery: {
    hasUndiscoveredLegacyRules: {
      type: 'noul',
      instructions: {
        question: 'Does the legacy F:\\HR implementation contain business rules, deductions, or validations that were missed or undocumented in the modern flow?',
        focus: 'Inspect legacy scripts for subtle business logic (e.g. deductions, penalties, allowance caps, overtime rules).',
      },
      criteria: {
        true: 'Undiscovered legacy business rules, deductions, or boundary conditions exist in F:\\HR that are missing from the modern flow.',
        false: 'All legacy business rules, calculations, and deductions are fully discovered and accounted for.',
      },
    } satisfies NoulQuestion,

    discoveryDepthScore: {
      type: 'score',
      instructions: 'Rate the depth and coverage of business rule discovery against the legacy F:\\HR baseline.',
      criteria: [
        'Level 0: No legacy rules discovered; naive rewrite assuming only happy path.',
        'Level 1: Basic validation discovered, but missing subtle deductions or penalty calculations.',
        'Level 2: Core financial and operational calculations discovered and mapped to domain models.',
        'Level 3: Full forensic discovery including all boundary conditions, multi-tier deductions, and corner cases.',
      ],
    } satisfies ScoreQuestion,
  },

  // 7. Speculative Fan-Out Batching - patterns/fan-out & cookbooks/parallel_questions
  speculativeFanOut: {
    canSpeculativelyFanOut: {
      type: 'noul',
      instructions: {
        question: 'Can these governance questions and audit dimensions be evaluated speculatively in parallel without serial state dependency?',
        focus: 'Ensure questions are atomic, self-contained, and do not depend on intermediate results.',
      },
      criteria: {
        true: 'All atomic questions can be dispatched concurrently in a single speculative fan-out batch.',
        false: 'Questions have serial data dependencies requiring sequential waterfall evaluation.',
      },
    } satisfies NoulQuestion,

    batchTopology: {
      type: 'choice',
      instructions: 'Classify the speculative fan-out execution topology for this audit workload.',
      criteria: {
        parallel_fan_out: 'All atomic questions dispatched simultaneously in parallel under 200ms latency budget.',
        staged_fan_out: 'Questions batched into 2 parallel stages with early termination gates.',
        serial_fallback: 'Serial fallback execution required due to sequential data dependencies.',
      },
    } satisfies ChoiceQuestion,
  },

  // 8. Temporal Invariants & Date Extraction Guard (Gate G11 / G23) - cookbooks/date_extraction_cookbook
  temporalInvariantGuard: {
    violatesTemporalInvariants: {
      type: 'noul',
      instructions: {
        question: 'Does the code or test violate temporal invariants such as the 26th-25th payroll monthly cycle or unpinned system time (Date.now())?',
        focus: 'Look for unpinned clocks (Date.now(), new Date()), timezone drift, or invalid month-cycle boundaries.',
      },
      criteria: {
        true: 'Temporal invariant breach detected: unpinned clock, invalid payroll cycle boundary, or non-deterministic timestamp.',
        false: 'Temporal invariants preserved: uses PINNED_BASE_TIME, respects 26th-25th payroll cycle, and pinned date boundaries.',
      },
    } satisfies NoulQuestion,

    payrollCycleClassification: {
      type: 'choice',
      instructions: 'Classify the payroll cycle and date boundary handling in this business logic or test.',
      criteria: {
        canonical_cycle: 'Strictly adheres to standard workforce payroll cycle (26th of previous month to 25th of current month).',
        custom_calendar_cycle: 'Explicitly declared and authorized alternative calendar cycle (e.g. 1st to end-of-month).',
        unanchored_drift: 'Unanchored date calculations using relative or unpinned system timestamps.',
      },
    } satisfies ChoiceQuestion,
  },

  // 9. Semantic Reuse Sentinel & Domain Reranker (Constitutional Rule 10.2) - cookbooks/rerank_typesafe & cookbooks/semantic_find
  semanticReuseSentinel: {
    hasDuplicateDomainHelper: {
      type: 'noul',
      instructions: {
        question: 'Does this change introduce redundant or duplicate helper functions instead of reusing existing canonical domain utilities in @alsaada/shared/domain or packages/shared/?',
        focus: 'Scan for locally re-implemented currency, date, formatting, or validation functions.',
      },
      criteria: {
        true: 'Duplicate domain helper detected: reinventing existing date, currency, or formatting utilities.',
        false: 'Strict reuse-first compliance: reuses canonical shared domain utilities.',
      },
    } satisfies NoulQuestion,

    reuseRecommendation: {
      type: 'choice',
      instructions: 'Classify the reuse status and rerank recommendation for helper utilities in this slice.',
      criteria: {
        canonical_reuse: 'Directly reuses existing domain helpers from @alsaada/shared or packages/.',
        novel_candidate: 'Genuine novel domain utility eligible for promotion to shared domain package.',
        redundant_duplicate: 'Redundant utility that shadows existing helpers and should be excised.',
      },
    } satisfies ChoiceQuestion,
  },

  // 10. Skill Suggestion & Autonomous Squad Router - cookbooks/skill_suggestion & cookbooks/hierarchical_classification
  squadAutonomousRouter: {
    responsibleSquad: {
      type: 'choice',
      instructions: 'Hierarchically classify which engineering squad has primary responsibility for resolving findings in this audit.',
      criteria: {
        squad_finance_security: 'Squad Finance & Security: Financial integrity, ledgers, RBAC, double-entry accounting, secret masking, payroll cycles.',
        squad_implementation_ux: 'Squad Implementation & UX: Bot wizard flows, 10-file slices, Telegram UX, keyboards, messages.',
        squad_architecture_devops: 'Squad Architecture & DevOps: Monorepo boundaries, Docker, database migrations, CI/CD, outbox worker, layer purity.',
        squad_qa_migration: 'Squad QA & Migration: F:\\HR legacy parity, test authenticity, G1-G23 gate verification, docs/19 registry, doc-code drift.',
        all_clear: 'All governance gates passed; no squad intervention required.',
      },
    } satisfies ChoiceQuestion,

    defectSeverityScore: {
      type: 'score',
      instructions: 'Rate the severity and blast radius of the classified defect to guide remediation priority.',
      criteria: [
        'Level 0: Clean pass - no defects or governance breaches.',
        'Level 1: Minor cosmetic or ergonomic warning - non-blocking.',
        'Level 2: Quality gate warning or architectural drift - requires resolution before merge.',
        'Level 3: Critical constitutional breach, security flaw, or financial invariant violation - immediate stop-the-line.',
      ],
    } satisfies ScoreQuestion,
  },

  // 11. Doc-Code Drift Radar & Bi-directional Citation Radar (Gate G3 / G4 / G19) - cookbooks/citation_check & cookbooks/classifying_rag_passages
  docCodeDriftRadar: {
    hasDocCodeDrift: {
      type: 'noul',
      instructions: {
        question: 'Is there drift or discrepancy between the implementation code, flow contract (flow.contract.json), walkthrough documentation, and docs/19 registry?',
        focus: 'Verify state transitions, button callbacks, wizard steps, and documentation citations match physical code.',
      },
      criteria: {
        true: 'Doc-code drift detected: contract states, walkthrough diagrams, or migration registry diverge from code.',
        false: 'Bidirectional parity confirmed: code, contracts, walkthroughs, and migration registry match 100%.',
      },
    } satisfies NoulQuestion,

    documentationParityScore: {
      type: 'score',
      instructions: 'Rate the completeness and fidelity of documentation across flow contracts, walkthrough diagrams, and migration registry.',
      criteria: [
        'Level 0: Missing documentation - no flow.contract.json or walkthrough.md exists.',
        'Level 1: Incomplete or stale documentation with broken state diagrams or missing callbacks.',
        'Level 2: Good documentation parity with accurate states, minor phrasing drift.',
        'Level 3: Perfect bidirectional citation parity across code, flow.contract.json, walkthrough.md, and docs/19.',
      ],
    } satisfies ScoreQuestion,
  },

  // 12. Error Telemetry & Observability Sentinel (Gate G9 / WP 91 / GEMINI.md 8.3)
  observabilityAndG9: {
    usesCanonicalCaptureFlowError: {
      type: 'noul',
      instructions: {
        question: 'Does the vertical slice boundary (controller.ts and error.handler.ts) strictly call await captureFlowError(error, boundedContext) imported from @alsaada/telemetry and return an incident ticket (#ERR-XXXXXXXX) without swallowing errors?',
        focus: 'Inspect catch blocks in controllers/handlers for unawaited captureFlowError or silent catch suppression.',
      },
      criteria: {
        true: 'Boundary handlers call await captureFlowError and report user error tickets without swallowing.',
        false: 'Errors swallowed silently in catch block, or unawaited captureFlowError, or mock handler used.',
      },
    } satisfies NoulQuestion,

    enforcesBoundedFlowContext: {
      type: 'noul',
      instructions: {
        question: 'Does error handling enforce BoundedFlowContext with flowSlug, flowKey, step, userId rather than loose untyped ctx?: unknown?',
        focus: 'Verify BoundedFlowContext contract compliance and non-blocking timeout fallback.',
      },
      criteria: {
        true: 'Strict BoundedFlowContext contract enforced with timeout and fallback.',
        false: 'Loose untyped ctx?: unknown used or context lacks flow metadata.',
      },
    } satisfies NoulQuestion,
  },

  // 13. Tri-Lifecycle & Rich Message Governance (WP 90, WP 93, WP 94, WP 95, GEMINI.md 6, 7.1, 8.1, 8.2)
  triLifecycleAndRichMessage: {
    richMessageAndEncyclopediaCompliance: {
      type: 'noul',
      instructions: {
        question: 'Are messages constructed using @alsaada/core-components/rich-message (buildRichPage, buildRichTable, buildRichConfirmation) and validated via assertRichMessage rather than raw strings?',
        focus: 'Verify zero raw text policy, single format mode (blocks/markdown/html), and Telegram Encyclopedia limits.',
      },
      criteria: {
        true: '100% compliant with rich-message builders and Telegram Encyclopedia formatting rules.',
        false: 'Raw string bypass, direct ctx.reply("string"), or exceeding Telegram message length/keyboard budgets.',
      },
    } satisfies NoulQuestion,

    triLifecycleAndLockCompliance: {
      type: 'choice',
      instructions: 'Classify compliance with Tri-Lifecycle sovereignty (Rulebook 11 Modification, Rulebook 12 Creation, Rulebook 08/WP 93 Defect Repair) and SHA-256 locks.',
      criteria: {
        compliant_sealed: 'Fully compliant with spec-first plans, OTP unlock verification, and sealed in governance.lock.json.',
        missing_spec_or_dossier: 'Code modified without approved work plan or completed incident dossier.',
        unlocked_entity_drift: 'Unlocked entity left unsealed in governance.lock.json.',
      },
    } satisfies ChoiceQuestion,
  },

  // 14. Permanent Skill & Plan Consultation (WP 96)
  skillAndPlanConsultation: {
    planSixPillarCompleteness: {
      type: 'score',
      instructions: 'Rate the completeness of the work plan against the 6 pillars (Scope, Data contracts, Telegram UX, Concurrency & Security, Test matrix, Acceptance criteria).',
      criteria: [
        'Level 0: No plan or shallow one-liner.',
        'Level 1: Basic scope described but missing data contracts or UX budget.',
        'Level 2: 4-5 pillars documented with test matrix and acceptance criteria.',
        'Level 3: Full 6-pillar sovereign specification with verified physical paths and zero placeholders.',
      ],
    } satisfies ScoreQuestion,

    skillRulebookAlignment: {
      type: 'noul',
      instructions: {
        question: 'Are all assigned skills from the sovereign skill graph (.agents/knowledge/sovereign-skill-graph.json) properly consulted and aligned with Rulebooks 01-12?',
        focus: 'Check skills alignment, rulebook references, and pre-task checklists.',
      },
      criteria: {
        true: 'Complete alignment: assigned skills and rulebooks actively verified and enforced.',
        false: 'Orphan skills, unreferenced rulebooks, or unfulfilled pre-task checklists.',
      },
    } satisfies NoulQuestion,
  },
} as const;

export const JEV_GOVERNANCE_WEIGHTS = {
  securityAndPrivacy: 0.15,
  architectureAndTypes: 0.12,
  testAuthenticity: 0.15,
  telegramErgonomics: 0.10,
  legacyParity: 0.10,
  temporalInvariants: 0.08,
  semanticReuse: 0.05,
  docCodeParity: 0.05,
  observabilityAndG9: 0.10,
  triLifecycleAndRichMessage: 0.10,
} as const;

