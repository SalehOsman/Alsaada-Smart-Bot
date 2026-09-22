/**
 * Test Authenticity AST Code Fixtures
 * Used by verify-test-authenticity.spec.ts to test detection of sham vs authentic code patterns.
 */

export const SHAM_INEQUALITY_FIXTURE = `
  const calls: number[] = [];
  expect(calls.length).toBeGreaterThanOrEqual(0);
`;

export const AUTHENTIC_BOUNDARY_FIXTURE = `
  const count = 5;
  expect(count).toBeGreaterThanOrEqual(1);
`;

export const TAUTOLOGY_FIXTURE = `
  const x = 42;
  expect(x).toBe(x);
  expect(x).toEqual(x);
`;

export const CONSTANT_LITERAL_FIXTURE = `
  const sampleAmount = 250.75;
  expect(sampleAmount).toBeGreaterThan(0);
`;

export const BOOLEAN_LITERAL_FIXTURE = `
  expect(true).toBeTruthy();
  expect(false).toBeFalsy();
`;

export const AUTHENTIC_EXECUTION_FIXTURE = `
  const response = { status: 'SUCCESS', code: 200 };
  expect(response.status).toBe('SUCCESS');
  expect(response.code).toBe(200);
`;

export const SYNTHETIC_MUTEX_FIXTURE = `
  class TestMutex {
    lock() {}
  }
`;
