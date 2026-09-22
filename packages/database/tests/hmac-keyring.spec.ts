import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeHmacSignature,
  verifyHmacSignature,
  HmacKeyring,
  DEFAULT_KEYRING,
} from '../src/ledger/hash-chain.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('HMAC Keyring & Cryptographic Rotation Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const samplePayload = {
    ledgerSeq: 101n,
    prevHash: 'a'.repeat(64),
    currentHash: 'b'.repeat(64),
    createdAt: new Date('2026-09-20T12:00:00.000Z'),
    amount: 1500.5,
  };

  it('computes valid HMAC-SHA256 signature using active key', () => {
    // Arrange
    const activeKey = DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key;

    // Act
    const signature = computeHmacSignature(samplePayload, activeKey);
    const isValid = verifyHmacSignature(
      {
        ...samplePayload,
        signature,
        kid: DEFAULT_KEYRING.activeKid,
      },
      DEFAULT_KEYRING
    );

    // Assert
    expect(signature).toBeDefined();
    expect(signature).toHaveLength(64);
    expect(isValid).toBe(true);
  });

  it('verifies signatures across 90-day key rotation cycle for active and retired keys', () => {
    // Arrange
    const keyring: HmacKeyring = {
      activeKid: 'v1-2026-q1',
      keys: {
        'v1-2026-q1': {
          kid: 'v1-2026-q1',
          key: 'secret-key-for-2026-q1-active',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    };
    const sigQ1 = computeHmacSignature(samplePayload, keyring.keys['v1-2026-q1']!.key);

    keyring.keys['v1-2026-q1']!.status = 'retired';
    keyring.keys['v1-2026-q1']!.retiredAt = '2026-04-01T00:00:00.000Z';
    keyring.activeKid = 'v2-2026-q2';
    keyring.keys['v2-2026-q2'] = {
      kid: 'v2-2026-q2',
      key: 'secret-key-for-2026-q2-active',
      status: 'active',
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    const payloadQ2 = {
      ...samplePayload,
      ledgerSeq: 102n,
      currentHash: 'c'.repeat(64),
    };
    const sigQ2 = computeHmacSignature(payloadQ2, keyring.keys['v2-2026-q2']!.key);

    // Act
    const isQ1Valid = verifyHmacSignature(
      {
        ...samplePayload,
        signature: sigQ1,
        kid: 'v1-2026-q1',
      },
      keyring
    );
    const isQ2Valid = verifyHmacSignature(
      {
        ...payloadQ2,
        signature: sigQ2,
        kid: 'v2-2026-q2',
      },
      keyring
    );

    // Assert
    expect(isQ1Valid).toBe(true);
    expect(isQ2Valid).toBe(true);
  });

  it('rejects verification if kid does not exist in keyring', () => {
    // Arrange
    const signature = computeHmacSignature(samplePayload, 'some-foreign-key');
    const payloadWithUnknownKid = {
      ...samplePayload,
      signature,
      kid: 'v99-unknown-kid',
    };

    // Act
    const isValid = verifyHmacSignature(payloadWithUnknownKid, DEFAULT_KEYRING);

    // Assert
    expect(isValid).toBe(false);
  });

  it('rejects verification if payload was tampered', () => {
    // Arrange
    const activeKey = DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key;
    const signature = computeHmacSignature(samplePayload, activeKey);
    const tamperedPayload = {
      ...samplePayload,
      amount: 999999.99,
      signature,
      kid: DEFAULT_KEYRING.activeKid,
    };

    // Act
    const isValid = verifyHmacSignature(tamperedPayload, DEFAULT_KEYRING);

    // Assert
    expect(isValid).toBe(false);
  });

  it('rejects verification if signature string is corrupted', () => {
    // Arrange
    const activeKey = DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key;
    const signature = computeHmacSignature(samplePayload, activeKey);
    const corruptedSig = signature.substring(0, 60) + 'ffff';
    const corruptedPayload = {
      ...samplePayload,
      signature: corruptedSig,
      kid: DEFAULT_KEYRING.activeKid,
    };

    // Act
    const isValid = verifyHmacSignature(corruptedPayload, DEFAULT_KEYRING);

    // Assert
    expect(isValid).toBe(false);
  });
});
