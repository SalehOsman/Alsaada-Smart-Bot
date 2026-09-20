import { describe, it, expect } from 'vitest';
import {
  computeHmacSignature,
  verifyHmacSignature,
  HmacKeyring,
  DEFAULT_KEYRING,
} from '../src/ledger/hash-chain.js';

describe('HMAC Keyring & Cryptographic Rotation Verification', () => {
  const samplePayload = {
    ledgerSeq: 101n,
    prevHash: 'a'.repeat(64),
    currentHash: 'b'.repeat(64),
    createdAt: new Date('2026-09-20T12:00:00.000Z'),
    amount: 1500.5,
  };

  it('should compute valid HMAC-SHA256 signature using active key', () => {
    const signature = computeHmacSignature(
      samplePayload,
      DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key
    );

    expect(signature).toBeDefined();
    expect(signature).toHaveLength(64); // Hex SHA-256 is 64 characters

    const isValid = verifyHmacSignature(
      {
        ...samplePayload,
        signature,
        kid: DEFAULT_KEYRING.activeKid,
      },
      DEFAULT_KEYRING
    );

    expect(isValid).toBe(true);
  });

  it('should verify signatures across 90-day key rotation cycle (active & retired)', () => {
    // Initial Keyring with Q1 active key
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

    // Sign record with Q1 key
    const sigQ1 = computeHmacSignature(samplePayload, keyring.keys['v1-2026-q1']!.key);

    // Rotate keyring to Q2: retire Q1, introduce Q2 active key
    keyring.keys['v1-2026-q1']!.status = 'retired';
    keyring.keys['v1-2026-q1']!.retiredAt = '2026-04-01T00:00:00.000Z';
    keyring.activeKid = 'v2-2026-q2';
    keyring.keys['v2-2026-q2'] = {
      kid: 'v2-2026-q2',
      key: 'secret-key-for-2026-q2-active',
      status: 'active',
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    // 1. Verify old Q1 record using retired key entry
    const isQ1Valid = verifyHmacSignature(
      {
        ...samplePayload,
        signature: sigQ1,
        kid: 'v1-2026-q1',
      },
      keyring
    );
    expect(isQ1Valid).toBe(true);

    // 2. Sign new record with Q2 active key
    const payloadQ2 = {
      ...samplePayload,
      ledgerSeq: 102n,
      currentHash: 'c'.repeat(64),
    };
    const sigQ2 = computeHmacSignature(payloadQ2, keyring.keys['v2-2026-q2']!.key);

    const isQ2Valid = verifyHmacSignature(
      {
        ...payloadQ2,
        signature: sigQ2,
        kid: 'v2-2026-q2',
      },
      keyring
    );
    expect(isQ2Valid).toBe(true);
  });

  it('should reject verification if kid does not exist in keyring', () => {
    const signature = computeHmacSignature(samplePayload, 'some-foreign-key');

    const isValid = verifyHmacSignature(
      {
        ...samplePayload,
        signature,
        kid: 'v99-unknown-kid',
      },
      DEFAULT_KEYRING
    );

    expect(isValid).toBe(false);
  });

  it('should reject verification if payload was tampered', () => {
    const activeKey = DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key;
    const signature = computeHmacSignature(samplePayload, activeKey);

    // Tamper amount
    const tamperedPayload = {
      ...samplePayload,
      amount: 999999.99,
      signature,
      kid: DEFAULT_KEYRING.activeKid,
    };

    const isValid = verifyHmacSignature(tamperedPayload, DEFAULT_KEYRING);
    expect(isValid).toBe(false);
  });

  it('should reject verification if signature string is corrupted', () => {
    const activeKey = DEFAULT_KEYRING.keys[DEFAULT_KEYRING.activeKid]!.key;
    const signature = computeHmacSignature(samplePayload, activeKey);
    const corruptedSig = signature.substring(0, 60) + 'ffff';

    const isValid = verifyHmacSignature(
      {
        ...samplePayload,
        signature: corruptedSig,
        kid: DEFAULT_KEYRING.activeKid,
      },
      DEFAULT_KEYRING
    );

    expect(isValid).toBe(false);
  });
});
