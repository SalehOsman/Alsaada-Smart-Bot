# Naming and Functions Standards (TypeScript Edition)

## 1. Intent-Revealing Names

Names must answer:
- **Why it exists**
- **What it does**
- **How it is used**

### Prohibited Generic Names
- `data`, `data2`, `res`, `result`, `result_final`, `item`, `temp`, `val`, `value`
- `obj`, `info`, `helper`, `manager`, `utils`
- `processData()`, `handleInput()`, `doTask()`

### Domain-Aligned Replacements
| Bad | Good | Domain Context |
| :--- | :--- | :--- |
| `const data = await get();` | `const workerSalaryRecord = await fetchSalaryRecord(workerId);` | Payroll |
| `function handle(val: any)` | `function processAdvanceApplication(application: AdvanceApplicationInput)` | Advances |
| `const temp = 0;` | `let runningLedgerDebitTotal = 0;` | Accounting |
| `function check(item: any)` | `function validateNationalIdChecksum(nationalId: string)` | Compliance |

## 2. Function Size & Cohesion
- **Target Line Count:** Functions should target ≤ 20 lines of code.
- **Single Responsibility:** A function should do exactly one thing at a single level of abstraction.
- **Parameter Ceiling:** Maximum 4 arguments. For 5+ arguments, encapsulate into a typed interface / options object:
  ```typescript
  // ❌ Too many parameters
  function createAdvance(workerId: string, amount: number, installments: number, reason: string, approverId: string, date: Date) {}

  // ✅ Typed parameter object
  interface CreateAdvanceOptions {
    workerId: string;
    amount: number;
    installments: number;
    reason: string;
    approverId: string;
    effectiveDate: Date;
  }
  function createAdvance(options: CreateAdvanceOptions) {}
  ```

## 3. Command-Query Separation (CQS)
- **Commands:** Mutate state and return `void` or a minimal status/receipt object. Use active verbs: `recordTransaction()`, `transitionToApproved()`.
- **Queries:** Return a computation without mutating system state. Use nouns or descriptive getters: `calculateOvertimePay()`, `getWorkerActiveCustody()`.
- **Side-Effect Free Queries:** A getter or calculation function must never write to database, publish events, or mutate session state.
