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
} as const;

export const JEV_GOVERNANCE_WEIGHTS = {
  securityAndPrivacy: 0.30,
  architectureAndTypes: 0.25,
  testAuthenticity: 0.20,
  telegramErgonomics: 0.15,
  legacyParity: 0.10,
} as const;
